require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadExchangeInfo } = require('./exchangeInfo');
const { STRATEGY_NAME } = require('./constants');

// refactor strategies
// const watchFractals50Strategy = require('./watchFractals50Strategy');
// const watchFractals100Strategy = require('./watchFractalsStrategy');
// const watchEngulfingStrategy = require('./watchRsiEmaEngulfingStrategy');
// const watchEmaCrossMacdStrategy = require('./watchEmaCrossMacdStrategy');
// refactored
const EmaStochRsiAtrStrategy = require('./strategy/EmaStochRsiAtrStrategy');
const EmaCross1030 = require('./strategy/EmaCross1030');
const MacdCrossSimple = require('./strategy/MacdCrossSimple');

const STRATEGIES = {
  EMA_STOCH_RSI: EmaStochRsiAtrStrategy,
  EMA_CROSS_10_30: EmaCross1030,
  MACD_CROSS_SIMPLE: MacdCrossSimple
};

runApp();

async function runApp() {
  if (!STRATEGIES[STRATEGY_NAME]) {
    throw `Incorrect STRATEGY_NAME env variable. Aborting.`;
  }

  // ---- bootstrap phase ----
  await binance.useServerTime();
  await loadExchangeInfo();

  await loadBalances();

  // ---- end bootstrap phase ----

  // ---- Test stuff ----
  // hasFundsToBuy();
  // const prices = await binance.prices();
  // console.log('🔥 filter', filters.MATICUSDT);
  // console.log('🔥 balance', balances.USDT);
  // Test purchase
  // buy('MATICUSDT', prices.MATICUSDT);
  // setStopLoss('MATICUSDT', 9.16, 0.852);
  // liquidateStopLoss('SRMBUSD');
  // console.log('🔥', roundPricePrecision('MATICUSDT', '8.12349080809098'));
  // watchAccountUpdates();

  // ---- use selected trade strategy ----
  // watchFractalsStrategy();
  // watchEngulfingStrategy();
  // watchEmaStochRsiAtrStrategy();

  console.log(`Use strategy: ${STRATEGY_NAME}`);
  const Strategy = new STRATEGIES[STRATEGY_NAME]();
  Strategy.run();
}
