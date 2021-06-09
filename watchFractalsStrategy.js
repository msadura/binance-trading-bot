const { hasFundsToBuy, getBalance } = require('./balances');
const binance = require('./binanceApi');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const williamsFractals = require('./ohlc/indicators/williamsFractals');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData, getOhlc } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');

const CANDLE_PERIOD = '1m';
const haCache = {};

async function watchFractalsStrategy() {
  const watchPairs = ['MATICUSDT'];
  await prepareHistoricalOhlcData(watchPairs);

  const onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);
    // debugger;
    // check for tp sell signal
    // check for buy signal
    // check for stop loss signal (emergency sell)
    // add to transaction queue
  };

  watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: watchPairs });
  // watch trades ?
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
