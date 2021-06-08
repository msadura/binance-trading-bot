const { hasFundsToBuy, getBalance } = require('./balances');
const binance = require('./binanceApi');
const getWatchPairs = require('./getWatchPairs');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlc, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');

const CANDLE_PERIOD = '1M';
const haCache = {};

async function watchFractalsStrategy() {
  const ohlcData = await loadCandlesForSymbols(getWatchPairs(), '5m');
  setOhlcData(ohlcData);

  const onCandle = (symbol, ticksData) => {
    const ohlc = addOhlc(symbol, ticksData);

    // build heikin ashi
    // check if should buy / sell do anything
  };

  // watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: getWatchPairs() });
}

module.exports = watchFractalsStrategy;
