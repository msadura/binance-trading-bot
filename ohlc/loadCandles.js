const binance = require('../binanceApi');
const { sleep, logUsedRequestsLimit } = require('../utils');

const OHLC_HISTORY_SIZE = 15;

async function loadCandlesForSymbol(symbol, interval, limit = OHLC_HISTORY_SIZE) {
  const options = {};
  if (limit) {
    options.limit = limit;
  }
  const candles = await binance.candlesticks(symbol, interval, false, options);
  const ohlcData = candles.map(c => {
    let [time, open, high, low, close, volume] = c;
    return { time, open, high, low, close, volume };
  });

  return ohlcData;
}

async function loadCandlesForSymbols(symbolsArray, interval, limit = OHLC_HISTORY_SIZE) {
  const data = {};
  console.log(
    '📈',
    `Loading OHLC data for ${symbolsArray.length} pairs, interval ${interval}, limit ${limit}...`
  );
  for (const symbol of symbolsArray) {
    await sleep(10);
    data[symbol] = await loadCandlesForSymbol(symbol, interval, limit);
  }

  console.log('📈', `Loaded OHLC data for ${symbolsArray.length} pairs`);
  logUsedRequestsLimit();

  return data;
}

module.exports = { loadCandlesForSymbol, loadCandlesForSymbols };
