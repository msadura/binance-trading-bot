require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadExchangeInfo } = require('./exchangeInfo');
const { loadAccountOrdersState } = require('./trades/spotTrades');
// const watchAccountUpdates = require('./trades/watchAccountUpdates');

// const watchFractalsStrategy = require('./watchFractals50Strategy');
const watchFractalsStrategy = require('./watchFractals50Strategy');
const watchEngulfingStrategy = require('./watchRsiEmaEngulfingStrategy');
const watchEmaStochRsiAtrStrategy = require('./watchEmaStochRsiAtrStrategy');

runApp();

async function runApp() {
  // ---- bootstrap phase ----
  await binance.useServerTime();
  await loadExchangeInfo();

  await loadBalances();
  await loadAccountOrdersState();

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

  // ---- use selected trade strategy ----
  // watchLivePricesStrategy();
  // watchHeikinAshiStrategy();
  // watchAccountUpdates();
  // watchFractalsStrategy();
  // watchEngulfingStrategy();
  watchEmaStochRsiAtrStrategy();
}
