const binance = require('../binanceApi');
const { sleep, logUsedRequestsLimit, roundPricePrecision } = require('../utils');

const OHLC_HISTORY_SIZE = 15;

async function loadCandlesForSymbol(symbol, interval, limit = OHLC_HISTORY_SIZE) {
  const options = {};
  if (limit) {
    options.limit = limit;
  }
  const candles = await binance.candlesticks(symbol, interval, false, options);
  let ohlcData = candles.map(c => {
    let [time, open, high, low, close, volume, closeTime] = c;
    if (new Date(closeTime) > new Date()) {
      // do not set data for open candle
      return null;
    }

    return {
      time,
      timeObj: new Date(time),
      closeTime,
      volume: Number(volume),
      open: roundPricePrecision(symbol, open),
      high: roundPricePrecision(symbol, high),
      low: roundPricePrecision(symbol, low),
      close: roundPricePrecision(symbol, close)
    };
  });
  // filter open candles
  ohlcData = ohlcData.filter(Boolean);

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
