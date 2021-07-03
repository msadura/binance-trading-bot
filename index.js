require('dotenv').config();
const binance = require('./binanceApi');
const { loadBalances } = require('./balances');
const { loadSymbolPrice } = require('./prices');
const { loadExchangeInfo } = require('./exchangeInfo');

// refactor strategies
// const watchFractals50Strategy = require('./watchFractals50Strategy');
// const watchFractals100Strategy = require('./watchFractalsStrategy');
// const watchEngulfingStrategy = require('./watchRsiEmaEngulfingStrategy');
// const watchEmaCrossMacdStrategy = require('./watchEmaCrossMacdStrategy');
// refactored
const EmaStochRsiAtrStrategy = require('./strategy/EmaStochRsiAtrStrategy');
const EmaCross1030 = require('./strategy/EmaCross1030');

const strategies = {
  emaStochRSI: EmaStochRsiAtrStrategy,
  emaCross1030: EmaCross1030
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
  loadSymbolPrice('BNBUSDT');

  // ---- use selected trade strategy ----
  // watchFractalsStrategy();
  // watchEngulfingStrategy();
  // watchEmaStochRsiAtrStrategy();
  const Strategy = new strategies.emaCross1030();
  Strategy.run();
}
