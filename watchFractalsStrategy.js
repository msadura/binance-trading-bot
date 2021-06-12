const { hasFundsToBuy } = require('./balances');
const { SINGLE_TRANSACTION_USD_AMOUNT } = require('./constants');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const williamsFractals = require('./ohlc/indicators/williamsFractals');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');
const { queueTransaction } = require('./transactions');
const { roundPricePrecision } = require('./utils');
const watchAccountUpdates = require('./trades/watchAccountUpdates');
const watchOpenSpotTrades = require('./trades/watchOpenSpotTrades');
const { getSpotTrades } = require('./trades/spotTrades');

const RISK_REWARD_RATIO = 1.5;
const STOP_LOSS_SELL_RATIO = 0.005;
const CANDLE_PERIOD = '5m';

async function watchFractalsStrategy() {
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
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();
  if (openTrades[symbol]) {
    return;
  }

  const fractalPosition = ohlc.length - 3;
  const referenceCandle = ohlc[fractalPosition];
  const lastCandle = ohlc[ohlc.length - 1];
  const isLong = isLongSignal(referenceCandle);
  if (isLong) {
    const prices = getPriceLevelsForLong(symbol, referenceCandle, lastCandle);
    if (hasFundsToBuy(SINGLE_TRANSACTION_USD_AMOUNT)) {
      queueTransaction('TRADE_ORDER', { symbol, ...prices });
    }
  }
}

function isLongSignal(candle) {
  // bullish fractal
  if (!candle.isBullishFractal) {
    return false;
  }

  // emas with correct size ema20 > ema50 > ema100
  const ema = candle.ema;
  if (ema[20] < ema[50] || ema[50] < ema[100]) {
    return false;
  }

  const { low } = candle;
  // low price is lower than ema20 and higher than ema100
  if (low > ema[20] || low < ema[100]) {
    return false;
  }

  // all conditions met! We've got a long signal
  return true;
}

function getPriceLevelsForLong(symbol, referenceCandle, lastCandle) {
  const slEmaType = referenceCandle.low < referenceCandle.ema[50] ? 100 : 50;
  const { close: currentPrice } = lastCandle;

  const slStop = roundPricePrecision(symbol, lastCandle.ema[slEmaType]);
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

  setOhlcData(ohlcData);
}

function addIndicators(ohlcArray, { symbol, checkAll } = {}) {
  let data = [...ohlcArray];
  data = williamsFractals(data, { checkAll });
  data = ema(data, { period: 100, symbol, checkAll });
  data = ema(data, { period: 50, symbol, checkAll });
  data = ema(data, { period: 20, symbol, checkAll });
  return data;
}

module.exports = watchFractalsStrategy;
