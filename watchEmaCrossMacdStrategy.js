const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');
const { queueTransaction } = require('./transactions');
const { roundPricePrecision } = require('./utils');
const watchAccountUpdates = require('./trades/watchAccountUpdates');
const watchOpenSpotTrades = require('./trades/watchOpenSpotTrades');
const { getSpotTrades } = require('./trades/spotTrades');
const macd = require('./ohlc/indicators/macd');
const atr = require('./ohlc/indicators/atr');
const { loadAccountOrdersState } = require('./trades/spotTrades');

const STOP_LOSS_SELL_RATIO = 0.005;
const RISK_REWARD_RATIO = 1.5;
const ATR_SL_RATIO = 2;
const PRICE_UPDATE_RANGE_RATIO = 0.5; // 0,5 * atr
const CANDLE_PERIOD = '1h';
let watchPairs = [];

async function watchEmaCrossMacd() {
  await loadAccountOrdersState(RISK_REWARD_RATIO);

  watchPairs = await getWatchPairs({ withLeverages: true, highVolume: true });
  // const watchPairs = [
  //   'ETCUSDT',
  //   'MATICUSDT',
  //   'RUNEUSDT',
  //   'BTCUSDT',
  //   'DOGEUSDT',
  //   'SXPUSDT',
  //   'FTMUSDT',
  //   'SOLUSDT',
  //   'UNIUSDT',
  //   'AVAXUSDT',
  //   'ATOMUSDT',
  //   'SRMUSDT',
  //   'CRVUSDT'
  // ];
  // watchPairs = ['BTCUSDT'];

  await prepareHistoricalOhlcData(watchPairs);

  const onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);

    checkForTradeSignal(symbol, ohlc);
  };

  watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: watchPairs });
  watchAccountUpdates();
  watchOpenSpotTrades(watchPairs);
  // watchIdle(config => queueTransaction('CLOSE_POSITION', config), 60 * 5);
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();

  const lastCandle = ohlc[ohlc.length - 1];
  const prevCandle = ohlc[ohlc.length - 2];

  // console.log('🔥 symbol: ', symbol);

  if (openTrades[symbol] && isClosePositionSignal(lastCandle, prevCandle)) {
    console.log('🔥', 'MANUAL SELL CONDITIONS MET');
    queueTransaction('CLOSE_POSITION', openTrades[symbol]);
    return;
  }

  const updatePriceConfig = getPriceUpdateConfig(symbol, lastCandle.close);
  if (updatePriceConfig) {
    console.log('🔥', `${symbol} - SL / TP Level update`);
    queueTransaction('POST_TRADE_ORDER', updatePriceConfig);
    return;
  }

  // console.log('🔥 symbol check:', symbol, ohlc);
  const isLong = isLongSignal(lastCandle, prevCandle);
  if (!openTrades[symbol] && isLong) {
    const prices = getPriceLevelsForLong(symbol, {
      priceRange: lastCandle.atr,
      currentPrice: lastCandle.close
    });
    // console.log('🔥', 'GOT TRADE SIGNAL!', { symbol, ...prices });
    // console.log('🔥 candle', lastCandle);
    queueTransaction('TRADE_ORDER', { symbol, ...prices, side: 'BUY' });
  }
}

function isLongSignal(candle, prevCandle) {
  // lacking indicators
  if (!candle.ema || !candle.macd) {
    return false;
  }

  // if (candle.close < candle.ema[200]) {
  //   return false;
  // }

  // ema[10] > ema[30]
  if (candle.ema[10] < candle.ema[30]) {
    return false;
  }

  // macd: MACD - green, signal - red
  if (candle.macd.MACD <= candle.macd.signal || candle.macd.MACD <= 0) {
    return false;
  }

  // long - ema cross
  // prev[ema10] < prev[ema30] && ema[10] > ema[30]
  if (prevCandle.ema[10] < prevCandle.ema[30]) {
    return true;
  }

  //macd cross up + ema10 > ema30
  // if (prevCandle.macd.signal < prevCandle.macd.MACD && candle.macd.signal >= candle.macd.MACD) {
  //   return true;
  // }

  // all conditions met! We've got a long signal
  return false;
}

function getPriceUpdateConfig(symbol, price) {
  const openTrades = getSpotTrades();
  const trade = openTrades[symbol];
  if (!trade) {
    return;
  }

  if (trade.side === 'BUY') {
    return getLongPriceUpdateConfig(trade, price);
  }
}

function getLongPriceUpdateConfig(trade, price) {
  if (trade.refPrice >= price) {
    return null;
  }

  const { refPrice, priceUpdateRange, symbol } = trade;
  if (price > refPrice + priceUpdateRange) {
    const updatedPrices = getPriceLevelsForLong(symbol, {
      currentPrice: price,
      priceRange: priceUpdateRange
    });

    return { ...trade, ...updatedPrices };
  }
}

function isClosePositionSignal(candle) {
  // macd: MACD - green, signal - red

  if (!candle.ema || !candle.macd) {
    return false;
  }

  if (candle.ema[10] <= candle.ema[30]) {
    console.log('🔥', 'EMA cross close position signal');
    console.log('🔥', `${candle.ema[10]} <= ${candle.ema[30]}`);
    return true;
  }

  // macd cross
  // prevCandle.macd.signal >= prevCandle.macd.MACD &&
  if (candle.macd.MACD <= candle.macd.signal) {
    console.log('🔥', 'MACD cross close position signal');
    console.log('🔥', `${candle.macd.MACD} <= ${candle.macd.signal}`);
    return true;
  }

  return false;
}

function getPriceLevelsForLong(symbol, { currentPrice, priceRange }) {
  const slRange = priceRange * ATR_SL_RATIO;
  const slStop = roundPricePrecision(symbol, currentPrice - slRange);
  const slSell = roundPricePrecision(symbol, slStop - slStop * STOP_LOSS_SELL_RATIO);
  const tpSell = roundPricePrecision(symbol, currentPrice + slRange * RISK_REWARD_RATIO);
  const refPrice = roundPricePrecision(symbol, currentPrice);
  const priceUpdateRange = priceRange * PRICE_UPDATE_RANGE_RATIO;

  return { slStop, slSell, tpSell, refPrice, priceUpdateRange };
}

async function prepareHistoricalOhlcData(watchPairs) {
  let ohlcData = await loadCandlesForSymbols(watchPairs, CANDLE_PERIOD);

  watchPairs.forEach(pair => {
    // add needed indicators to ohlc data
    ohlcData[pair] = addIndicators(ohlcData[pair], { checkAll: true, symbol: pair });
  });

  // console.log('🔥 data:', ohlcData);

  setOhlcData(ohlcData);
}

function addIndicators(ohlcArray, { symbol, checkAll } = {}) {
  let data = [...ohlcArray];
  data = ema(data, { period: 10, symbol, checkAll });
  data = ema(data, { period: 30, symbol, checkAll });
  data = ema(data, { period: 200, symbol, checkAll });
  data = atr(data, { checkAll });
  data = macd(data, { symbol, checkAll });

  return data;
}

module.exports = watchEmaCrossMacd;
