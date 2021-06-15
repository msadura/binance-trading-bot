const { hasFundsToBuy } = require('./balances');
const { SINGLE_TRANSACTION_USD_AMOUNT } = require('./constants');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const rsi = require('./ohlc/indicators/rsi');
const engulfingPattern = require('./ohlc/indicators/engulfingPattern');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');
const { queueTransaction } = require('./transactions');
const { roundPricePrecision } = require('./utils');
const watchAccountUpdates = require('./trades/watchAccountUpdates');
const watchOpenSpotTrades = require('./trades/watchOpenSpotTrades');
const { getSpotTrades, watchIdle } = require('./trades/spotTrades');

const RISK_REWARD_RATIO = 1.5;
const STOP_LOSS_SELL_RATIO = 0.005;
const CANDLE_PERIOD = '1m';

async function watchRsiEmaEngulfingStrategy() {
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
  watchOpenSpotTrades(watchPairs);
  watchIdle(config => queueTransaction('SL_SELL', config));
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();
  if (openTrades.symbol) {
    return;
  }

  const lastCandle = ohlc[ohlc.length - 1];
  const isLong = isLongSignal(lastCandle);
  if (isLong) {
    const prices = getPriceLevelsForLong(symbol, lastCandle);
    if (hasFundsToBuy(SINGLE_TRANSACTION_USD_AMOUNT)) {
      // console.log('🔥', 'GOT TRADE SIGNAL!', { symbol, ...prices });
      // console.log('🔥 candle', lastCandle);
      queueTransaction('TRADE_ORDER', { symbol, ...prices });
    }
  }
}

function isLongSignal(candle) {
  // console.log('🔥', 'check ', candle);

  // bullish engulfing
  if (!candle.isBullishEngulfing) {
    return false;
  }

  const { ema, close, rsi } = candle;
  // price > ema 200
  if (ema[200] > close) {
    return false;
  }

  //rsi > 50
  if (rsi < 50) {
    return false;
  }

  // all conditions met! We've got a long signal
  return true;
}

function getPriceLevelsForLong(symbol, lastCandle) {
  const { close: currentPrice } = lastCandle;

  const slStop = roundPricePrecision(symbol, lastCandle.low);
  const slSell = roundPricePrecision(symbol, slStop - slStop * STOP_LOSS_SELL_RATIO);
  const tpSell = roundPricePrecision(
    symbol,
    currentPrice + (currentPrice - slStop) * RISK_REWARD_RATIO
  );
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
  data = engulfingPattern(data, { checkAll });
  data = ema(data, { period: 200, symbol, checkAll });
  data = rsi(data, { period: 14, symbol, checkAll });

  return data;
}

module.exports = watchRsiEmaEngulfingStrategy;
