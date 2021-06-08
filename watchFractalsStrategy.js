const { hasFundsToBuy, getBalance } = require('./balances');
const binance = require('./binanceApi');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const williamsFractals = require('./ohlc/indicators/williamsFractals');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlc, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');

const CANDLE_PERIOD = '1M';
const haCache = {};

async function watchFractalsStrategy() {
  const ohlcData = await loadCandlesForSymbols(['MATICUSDT'], '1h', 200);
  // console.log('🔥', ohlcData);
  // console.log('🔥', ohlcData.MATICUSDT);
  const ohlcF = williamsFractals(ohlcData.MATICUSDT, { checkAll: true });
  const ohlcEma = ema(ohlcF, { period: 100, symbol: 'MATICUSDT', checkAll: true });
  console.log('🔥', 'ss', ohlcEma.slice(100, 200));
  setOhlcData(ohlcData);

  const onCandle = (symbol, ticksData) => {
    const ohlc = addOhlc(symbol, ticksData);

    // build heikin ashi
    // check if should buy / sell do anything
  };

  // watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: getWatchPairs() });
}

module.exports = watchFractalsStrategy;
