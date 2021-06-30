require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadExchangeInfo } = require('./exchangeInfo');

// refactor strategies
const watchFractals50Strategy = require('./watchFractals50Strategy');
const watchFractals100Strategy = require('./watchFractalsStrategy');
const watchEngulfingStrategy = require('./watchRsiEmaEngulfingStrategy');
const watchEmaCrossMacdStrategy = require('./watchEmaCrossMacdStrategy');
// refactored
const EmaStochRsiAtrStrategy = require('./strategy/EmaStochRsiAtrStrategy');

const strategies = {
  fractals50: watchFractals50Strategy,
  fractals100: watchFractals100Strategy,
  engulfing: watchEngulfingStrategy,
  emaStochRSI: EmaStochRsiAtrStrategy,
  emaCross: watchEmaCrossMacdStrategy
};

runApp();

async function runApp() {
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
  const Strategy = new strategies.emaStochRSI();
  Strategy.run();
}
