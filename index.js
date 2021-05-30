require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadSymbolsInfo } = require('./filters');
const { loadAccountOrdersState } = require('./spotOrders');
const { watchLivePricesStrategy } = require('./watchLivePricesStrategy');

runApp();

async function runApp() {
  // ---- bootstrap phase ----
  await binance.useServerTime();
  await loadSymbolsInfo();

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
  watchLivePricesStrategy();
}
