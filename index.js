require('dotenv').config();
const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
  test: process.env.TEST_TRANSACTIONS
};

const UP_TRIGGER_LEVEL = 0.06;
const STOP_LOSS_PRICE_LEVEL = 0.03;
const STOP_LOSS_TRIGGER_LEVEL = 0.025;
const SINGLE_TRANSACTION_USD_AMOUNT = 15;

const binance = new Binance().options(config);
// list of all symbols to watch
const watchTickers = ['MATICUSDT', 'DOGEUSDT', 'CRVUSDT', 'SOLUSDT', 'BNBUSDT', 'SRMUSDT'];
const referencePrices = {};
const stopLossOrders = {};
let filters;
let balances;

function watchPrices() {
  binance.websockets.trades(watchTickers, trades => {
    let { s: symbol, p: priceStr } = trades;
    const price = Number(priceStr);

    if (stopLossOrders[symbol]) {
      purchasedSymbolPriceUpdated(symbol, price);
    }

    const refPrice = referencePrices[symbol];
    if (!refPrice) {
      referencePrices[symbol] = price;
      return;
    }

    if (refPrice > price) {
      referencePrices[symbol] = price;
      // console.info(`${symbol} - ${price}, 🔻`);
      return;
    }

    if (price > refPrice) {
      const percentageUp = price / refPrice - 1;
      // console.info(`${symbol} - ${price}, 🟢 ${percentageUp}%`);

      if (percentageUp >= UP_TRIGGER_LEVEL) {
        console.log('🟢', `${symbol} - Purchase level reached`);
        buy(symbol, price);
      }
    }
  });
}

async function buy(symbol, approxPrice) {
  const quantity = getAmountToBuy(symbol, approxPrice);

  try {
    const resp = await binance.marketBuy(symbol, quantity);
    // Example prod response
    // const resp = {
    //   clientOrderId: 'eS2SKoSfJSUaTMGY2a5aOo',
    //   cummulativeQuoteQty: '11.98687500',
    //   executedQty: '1.25000000',
    //   fills: [
    //     {
    //       commission: '0.00001590',
    //       commissionAsset: 'BNB',
    //       price: '9.58950000',
    //       qty: '1.25000000',
    //       tradeId: 1865645
    //     }
    //   ],
    //   orderId: 59298780,
    //   orderListId: -1,
    //   origQty: '1.25000000',
    //   price: '0.00000000',
    //   side: 'BUY',
    //   status: 'FILLED',
    //   symbol: 'SRMBUSD',
    //   timeInForce: 'GTC',
    //   transactTime: 1619586815786,
    //   type: 'MARKET'
    // };

    // await loadBalances();
    console.log('💰', `${symbol} - Purchased - qty: ${quantity} price: ${approxPrice}`);
    setStopLoss(symbol, approxPrice, resp.executedQty);
    // testSell(symbol, Number(resp.executedQty));
    debugger;
  } catch (e) {
    logResponseError(e);
    debugger;
  }
}

async function setStopLoss(symbol, approxPrice, quantity) {
  let sellQuantity = quantity;
  if (stopLossOrders[symbol]) {
    sellQuantity = sellQuantity || stopLossOrders[symbol].qty;
    console.log('🟡', `${symbol} - cancelling previous stop loss order`);
    await binance.cancel(symbol, stopLossOrders[symbol].id);
  }

  if (!quantity) {
    // TODO - fetch balances, get max qty
    return;
  }

  let type = 'STOP_LOSS_LIMIT';
  // TODO - figure out the best way to set up stop loss levels
  // 3% price down
  let price = roundPrecision(symbol, approxPrice - approxPrice * STOP_LOSS_PRICE_LEVEL);
  // 2.5% price down
  let stopPrice = roundPrecision(symbol, approxPrice - approxPrice * STOP_LOSS_TRIGGER_LEVEL);
  try {
    const resp = await binance.sell(symbol, quantity, price, { stopPrice: stopPrice, type: type });

    stopLossOrders[symbol] = {
      id: resp.id,
      qty: sellQuantity,
      price,
      stopPrice
    };

    console.log(
      '🟡',
      `${symbol} - Stop loss set - qty: ${sellQuantity} stopPrice: ${stopPrice} sellPrice: ${price}`
    );
  } catch (e) {
    logResponseError(e);
    debugger;
  }
}

function purchasedSymbolPriceUpdated(symbol, approxPrice) {
  const stopLoss = stopLossOrders[symbol];
  const updatedPrice = Number(approxPrice);

  if (updatedPrice > stopLoss.price) {
    const percentageUp = updatedPrice / stopLoss.price - 1;
    if (percentageUp > UP_TRIGGER_LEVEL) {
      console.log('🚀', `${symbol} - Price pump, increasing stop loss - price: ${approxPrice}`);
      setStopLoss(symbol, updatedPrice);
    }
  }

  if (updatedPrice < stopLoss.price) {
    liquidateStopLoss(symbol);
  }
}

async function liquidateStopLoss(symbol) {
  try {
    const allOrders = await binance.openOrders(symbol);
    const stopLossOrders = allOrders.filter(o => o.type === 'STOP_LOSS_LIMIT');
    if (stopLossOrders.length) {
      await binance.cancelAll(symbol);
      const quantity = stopLossOrders[symbol]?.qty;
      if (quantity) {
        console.log('🔴', `${symbol} - Emergency manual market sell`);
        await binance.marketSell(symbol, quantity);
      }
    }
  } catch (e) {
    logResponseError(e);
    debugger;
  }

  stopLossOrders[symbol] = null;
  console.log('🔴', `${symbol} - Stop loss triggered`);
}

// async function testSell(symbol, quantity) {
//   try {
//     const resp = await binance.marketSell(symbol, quantity);
//     debugger;
//   } catch (e) {
//     logResponseError(e);
//     debugger;
//   }
// }

function roundPrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const stepSize = filters[symbol]?.stepSize;
  return binance.roundStep(numToRound, stepSize);
}

function getAmountToBuy(symbol, approxPrice) {
  const amount = SINGLE_TRANSACTION_USD_AMOUNT / Number(approxPrice);
  return roundPrecision(symbol, amount);
}

async function loadSymbolsInfo() {
  const resp = await binance.exchangeInfo();
  let minimums = {};
  for (let obj of resp.symbols) {
    let filters = { status: obj.status };
    for (let filter of obj.filters) {
      if (filter.filterType == 'MIN_NOTIONAL') {
        filters.minNotional = filter.minNotional;
      } else if (filter.filterType == 'PRICE_FILTER') {
        filters.minPrice = filter.minPrice;
        filters.maxPrice = filter.maxPrice;
        filters.tickSize = filter.tickSize;
      } else if (filter.filterType == 'LOT_SIZE') {
        filters.stepSize = filter.stepSize;
        filters.minQty = filter.minQty;
        filters.maxQty = filter.maxQty;
      }
    }
    //filters.baseAssetPrecision = obj.baseAssetPrecision;
    //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
    filters.orderTypes = obj.orderTypes;
    filters.icebergAllowed = obj.icebergAllowed;
    minimums[obj.symbol] = filters;
  }
  filters = minimums;
}

async function loadBalances() {
  balances = await binance.balance();
}

async function runApp() {
  await binance.useServerTime();
  await loadSymbolsInfo();
  await loadBalances();

  // Test getting prices
  // const prices = await binance.prices();
  // console.log('🔥 price', prices.SRMBUSD, filters.SRMBUSD);
  // Test purchase
  // buy('SRMBUSD', prices.SRMUSDT);
  // setStopLoss('SRMBUSD', 9.16, 1.26);
  // liquidateStopLoss('SRMBUSD');

  // watchPrices();
}

function getResponseError(e) {
  if (e.body) {
    return JSON.parse(e.body);
  }

  return null;
}

function logResponseError(error) {
  const responseError = getResponseError(error);
  console.log('🔥 RES ERROR: ', `code: ${responseError.code}`, `message:${responseError.message}`);
}

runApp();
