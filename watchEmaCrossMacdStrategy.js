const { hasFundsToBuy } = require('./balances');
const { SINGLE_TRANSACTION_USD_AMOUNT } = require('./constants');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');
const { queueTransaction } = require('./transactions');
const { roundPricePrecision } = require('./utils');
const watchAccountUpdates = require('./trades/watchAccountUpdates');
const watchOpenSpotTrades = require('./trades/watchOpenSpotTrades');
const { getSpotTrades, watchIdle } = require('./trades/spotTrades');
const macd = require('./ohlc/indicators/macd');
const atr = require('./ohlc/indicators/atr');

const STOP_LOSS_SELL_RATIO = 0.005;
const RISK_REWARD_RATIO = 2;
const CANDLE_PERIOD = '15m';
let watchPairs = [];

async function watchEmaCrossMacd() {
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
  // watchPairs = ['MATICUSDT'];

  await prepareHistoricalOhlcData(watchPairs);

  const onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);

    checkForTradeSignal(symbol, ohlc);
    // console.log('🔥 last candle', ohlc[ohlc.length - 1]);
  };

  watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: watchPairs });
  watchAccountUpdates();
  watchOpenSpotTrades(watchPairs);
  // watchIdle(config => queueTransaction('SL_SELL', config), 60 * 5);
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();

  const lastCandle = ohlc[ohlc.length - 1];
  const prevCandle = ohlc[ohlc.length - 2];

  if (openTrades.symbol && isClosePositionSignal(lastCandle, prevCandle)) {
    console.log('🔥', 'MANUAL SELL CONDITIONS MET');
    queueTransaction('SL_SELL', openTrades.symbol);
  }
  // console.log('🔥 symbol check:', symbol, ohlc);
  const isLong = isLongSignal(lastCandle, prevCandle);
  if (!openTrades.symbol && isLong) {
    const prices = getPriceLevelsForLong(symbol, lastCandle);
    // console.log('🔥', 'GOT TRADE SIGNAL!', { symbol, ...prices });
    // console.log('🔥 candle', lastCandle);
    queueTransaction('TRADE_ORDER', { symbol, ...prices });
  }
}

function isLongSignal(candle, prevCandle) {
  // lacking indicators
  if (!candle.ema || !candle.macd) {
    return false;
  }

  // ema[10] > ema[30]
  if (candle.ema[10] < candle.ema[30]) {
    return false;
  }

  if (candle.macd.signal > candle.macd.MACD || candle.macd.signal <= 0) {
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

function isClosePositionSignal(candle, prevCandle) {
  // macd: MACD - red, signal - green

  if (!candle.ema || !candle.macd) {
    return false;
  }

  if (candle.ema[10] <= candle.ema[30]) {
    return true;
  }

  // macd cross
  if (prevCandle.macd.signal >= prevCandle.macd.MACD && candle.macd.signal <= candle.macd.MACD) {
    return true;
  }

  return false;
}

function getPriceLevelsForLong(symbol, lastCandle) {
  const { close: currentPrice, atr } = lastCandle;

  const slStop = roundPricePrecision(symbol, currentPrice - atr * 2);
  const slSell = roundPricePrecision(symbol, slStop - slStop * STOP_LOSS_SELL_RATIO);
  const tpSell = roundPricePrecision(symbol, currentPrice + atr * RISK_REWARD_RATIO);
  const refPrice = roundPricePrecision(symbol, currentPrice);

  return { slStop, slSell, tpSell, refPrice };
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
  data = atr(data, { checkAll });
  data = macd(data, { symbol, checkAll });

  return data;
}

module.exports = watchEmaCrossMacd;
