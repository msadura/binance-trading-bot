require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadExchangeInfo } = require('./exchangeInfo');

const watchFractals50Strategy = require('./watchFractals50Strategy');
const watchFractals100Strategy = require('./watchFractalsStrategy');
const watchEngulfingStrategy = require('./watchRsiEmaEngulfingStrategy');
const watchEmaStochRsiAtrStrategy = require('./watchEmaStochRsiAtrStrategy');
const watchEmaCrossMacdStrategy = require('./watchEmaCrossMacdStrategy');

const strategies = {
  fractals50: watchFractals50Strategy,
  fractals100: watchFractals100Strategy,
  engulfing: watchEngulfingStrategy,
  emaStochRSI: watchEmaStochRsiAtrStrategy,
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
  const runStrategy = strategies.emaStochRSI;

  runStrategy();
}
