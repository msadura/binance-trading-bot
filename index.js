require('dotenv').config();
const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
  test: false
};

const UP_TRIGGER_LEVEL = 0.04;
const STOP_LOSS_TRIGGER_LEVEL = 0.015;
const STOP_LOSS_PRICE_LEVEL = 0.02;
const SINGLE_TRANSACTION_USD_AMOUNT = 20;

const binance = new Binance().options(config);
// list of all symbols to watch
const watchTickers = ['MATICUSDT', 'CRVUSDT', 'SOLUSDT', 'BNBUSDT', 'SRMUSDT'];
const referencePrices = {};
const stopLossOrders = {};
const pendingTransactions = {};
let filters;
let balances;

function watchPrices() {
  binance.websockets.trades(watchTickers, trades => {
    let { s: symbol, p: priceStr } = trades;
    const price = Number(priceStr);

    if (pendingTransactions[symbol]) {
      return;
    }

    if (stopLossOrders[symbol]) {
      purchasedSymbolPriceUpdated(symbol, price);
      return;
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
        console.log('ℹ️', 'STOP LOSSES', stopLossOrders);
        console.log('🟢', `${symbol} - Purchase level reached`);
        pendingTransactions[symbol] = true;
        buy(symbol, price);
      }
    }
  });
}

async function buy(symbol, approxPrice) {
  const quantity = getAmountToBuy(symbol, approxPrice);

  try {
    console.log('💰', `${symbol} - Purchasing... - qty: ${quantity} price: ${approxPrice}`);
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
    console.log('💰', `${symbol} - Purchased - qty: ${resp.executedQty} price: ${approxPrice}`);
    setStopLoss(symbol, approxPrice, resp.executedQty);
    // testSell(symbol, Number(resp.executedQty));
    debugger;
  } catch (e) {
    console.log('🔴', `${symbol} - Failed to buy`);
    finishTransaction(symbol);
    logResponseError(e);
    debugger;
  }
}

async function setStopLoss(symbol, approxPrice, quantity) {
  const existingStopLoss = stopLossOrders[symbol];
  let sellQuantity = quantity || existingStopLoss?.qty;

  if (existingStopLoss) {
    console.log(
      '🟡',
      `${symbol} - cancelling previous stop loss order - id: ${existingStopLoss.id}`
    );
    try {
      await binance.cancel(symbol, existingStopLoss.id);
    } catch (e) {
      logResponseError(e);
    }
  }

  const balance = await getBalance(symbol);
  const availableToSell = roundQtyPrecision(symbol, balance.available);
  if (Number(availableToSell) === 0) {
    //Stop loss probably triggered already
    console.log('🟡', `${symbol} - No balance available - skipping stop loss order`);
    // refPrice might need to be updated here - test
    stopLossOrders[symbol] = null;
    finishTransaction(symbol);
  }

  if (sellQuantity && sellQuantity > availableToSell) {
    sellQuantity = availableToSell;
  }

  let type = 'STOP_LOSS_LIMIT';
  // TODO - figure out the best way to set up stop loss levels
  // 3% price down
  let price = roundPricePrecision(symbol, approxPrice - approxPrice * STOP_LOSS_PRICE_LEVEL);
  // 2.5% price down
  let stopPrice = roundPricePrecision(symbol, approxPrice - approxPrice * STOP_LOSS_TRIGGER_LEVEL);

  console.log(
    '🟡',
    `${symbol} - Setting stop loss... - qty: ${sellQuantity} stopPrice: ${stopPrice} sellPrice: ${price}`
  );

  try {
    const resp = await binance.sell(symbol, sellQuantity, price, {
      stopPrice: stopPrice,
      type: type
    });

    stopLossOrders[symbol] = {
      id: resp.orderId,
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
  } finally {
    finishTransaction(symbol);
  }
}

function purchasedSymbolPriceUpdated(symbol, approxPrice) {
  const stopLoss = stopLossOrders[symbol];
  const updatedPrice = Number(approxPrice);

  if (updatedPrice > stopLoss.stopPrice) {
    const percentageUp = updatedPrice / stopLoss.price - 1;
    if (percentageUp > UP_TRIGGER_LEVEL) {
      pendingTransactions[symbol] = true;
      console.log('🚀', `${symbol} - Price pump, increasing stop loss - price: ${approxPrice}`);
      setStopLoss(symbol, updatedPrice);
    }
  }

  if (updatedPrice < stopLoss.stopPrice) {
    pendingTransactions[symbol] = true;
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
  finishTransaction(symbol);
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

function roundQtyPrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const precision = filters[symbol]?.stepSize;
  return binance.roundStep(numToRound, precision);
}

function roundPricePrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const precision = filters[symbol]?.tickSize;
  return binance.roundStep(numToRound, precision);
}

function getAmountToBuy(symbol, approxPrice) {
  const amount = SINGLE_TRANSACTION_USD_AMOUNT / Number(approxPrice);
  return roundQtyPrecision(symbol, amount);
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

async function getBalance(symbol) {
  const coinSymbol = symbol.replace('USDT', '');
  await loadBalances();
  const balance = balances[coinSymbol];
  console.log('ℹ️', `${coinSymbol} - BALANCE`, balance);
  return balances[coinSymbol];
}

async function runApp() {
  await binance.useServerTime();
  await loadSymbolsInfo();
  await loadBalances();

  // Test stuff
  // Test getting prices
  // const prices = await binance.prices();
  // console.log('🔥 filter', filters.MATICUSDT);
  // console.log('🔥 balance', balances.MATIC);
  // Test purchase
  // buy('MATICUSDT', prices.MATICUSDT);
  // setStopLoss('MATICUSDT', 9.16, 0.852);
  // liquidateStopLoss('SRMBUSD');
  // console.log('🔥', roundPricePrecision('MATICUSDT', '8.12349080809098'));

  watchPrices();
}

function getResponseError(e) {
  if (e.body) {
    return JSON.parse(e.body);
  }

  return null;
}

function logResponseError(error) {
  const responseError = getResponseError(error);
  console.log('🔥', 'resp error', responseError);
  console.log('🔥 RES ERROR: ', `code: ${responseError.code}`, `message:${responseError.msg}`);
}

function finishTransaction(symbol) {
  pendingTransactions[symbol] = false;
}

runApp();
