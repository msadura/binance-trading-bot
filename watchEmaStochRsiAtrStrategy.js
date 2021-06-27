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
const stochasticRSI = require('./ohlc/indicators/stochasticRsi');
const atr = require('./ohlc/indicators/atr');
const { loadAccountOrdersState } = require('./trades/spotTrades');

const STOP_LOSS_SELL_RATIO = 0.005;
const CANDLE_PERIOD = '1h';
const RISK_REWARD_RATIO = 0.67;
const PRICE_UPDATE_RANGE_RATIO = 1; // 0,5 * atr

async function watchEmaStochRsiAtrStrategy() {
  await loadAccountOrdersState(RISK_REWARD_RATIO);

  const watchPairs = await getWatchPairs({ withLeverages: true, highVolume: true });
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
  // const watchPairs = ['MATICUSDT'];

  await prepareHistoricalOhlcData(watchPairs);

  const onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);

    checkForTradeSignal(symbol, ohlc);
  };

  watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: watchPairs });
  watchAccountUpdates();
  watchOpenSpotTrades(watchPairs, { priceUpdateCb: onPriceUpdate });
  // watchIdle(config => queueTransaction('SL_SELL', config), 60 * 5);
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();
  if (openTrades.symbol) {
    return;
  }

  const lastCandle = ohlc[ohlc.length - 1];
  const prevCandle = ohlc[ohlc.length - 2];

  // onPriceUpdate(symbol, lastCandle.close);

  const isLong = isLongSignal(lastCandle, prevCandle);
  if (!openTrades[symbol] && isLong) {
    const prices = getPriceLevelsForLong(symbol, {
      priceRange: lastCandle.atr,
      currentPrice: lastCandle.close
    });

    // console.log('🔥', 'GOT TRADE SIGNAL!', { symbol, ...prices });
    // console.log('🔥 candle', lastCandle);
    queueTransaction('TRADE_ORDER', { symbol, ...prices });
  }
}

function isLongSignal(candle, prevCandle) {
  const { ema } = candle;

  if (candle.close < ema[8]) {
    return;
  }

  if (ema[8] < ema[14] || ema[14] < ema[50]) {
    return false;
  }

  //stoch rsi cross
  // prev.k < prev.d && k > d
  if (
    prevCandle.stochasticRSI.k > prevCandle.stochasticRSI.d ||
    candle.stochasticRSI.k < candle.stochasticRSI.d
  ) {
    return false;
  }

  // all conditions met! We've got a long signal
  return true;
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

function getPriceLevelsForLong(symbol, { currentPrice, priceRange }) {
  const slRange = priceRange * 3;
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
  data = ema(data, { period: 50, symbol, checkAll });
  data = ema(data, { period: 14, symbol, checkAll });
  data = ema(data, { period: 8, symbol, checkAll });

  data = stochasticRSI(data, { checkAll, symbol });
  data = atr(data, { checkAll });
  //atr
  //stoch rsi

  return data;
}

function onPriceUpdate(symbol, price) {
  const updatePriceConfig = getPriceUpdateConfig(symbol, price);
  if (updatePriceConfig) {
    console.log('🔥', `${symbol} - SL / TP Level update`);
    queueTransaction('POST_TRADE_ORDER', updatePriceConfig);
    return true;
  }
}

module.exports = watchEmaStochRsiAtrStrategy;
