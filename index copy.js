require('dotenv').config();
const Binance = require('node-binance-api');

const config = {
  APIKEY: 'Q5mSUHr9FONcEgfC7JAc7OFuchk2IYazKkuGvJWleoGj1d1ZAr5pRVZbuasZhViu',
  APISECRET: '2C8I31vPVNjtUl58rF4jJtNgEuKIWnk9Kj4QNyhGsL2EHefrydxjG686XnMFMVqd',
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
  // Change to tru for fake transactions
  test: false
};

const UP_TRIGGER_LEVEL = 0.03;
const STOP_LOSS_TRIGGER_LEVEL = 0.06;
const STOP_LOSS_PRICE_LEVEL = 0.065;
const SINGLE_TRANSACTION_USD_AMOUNT = 200; //$
const IDLE_MINUTES_TRIGGER = 30;

const binance = new Binance().options(config);
// list of all symbols to watch
const watchTickers = ['MATICUSDT', 'CRVUSDT', 'SOLUSDT', 'BNBUSDT', 'SRMUSDT'];
const referencePrices = {};
const stopLossOrders = {};
const pendingTransactions = {};
let transactionInProgress = false;
let filters;
let balances;
let prices;
const blockTradeCoins = ['AVAX', 'DOGE', 'BEAM'];

runApp();

async function runApp() {
  await binance.useServerTime();
  await loadSymbolsInfo();
  await loadBalances();
  await loadAccountOrdersState();

  // Test stuff
  // hasFundsToBuy();
  // const prices = await binance.prices();
  // console.log('🔥 filter', filters.MATICUSDT);
  // console.log('🔥 balance', balances.USDT);
  // Test purchase
  // buy('MATICUSDT', prices.MATICUSDT);
  // setStopLoss('MATICUSDT', 9.16, 0.852);
  // liquidateStopLoss('SRMBUSD');
  // console.log('🔥', roundPricePrecision('MATICUSDT', '8.12349080809098'));

  // watchPrices(watchTickers);
  watchIdle();
  watchAllUSDT();
}

function watchAllUSDT() {
  const USDTPairs = Object.keys(filters).filter(p => p.includes('USDT'));
  const USDTPairsNoLeverages = filterLeverages(USDTPairs);

  //TEMP - remove owned coins, that should not be traded
  const USDTPairsFiltered = USDTPairsNoLeverages.filter(p => canTradePair(p));

  watchPrices(USDTPairsFiltered);
}

function canTradePair(symbol) {
  return !blockTradeCoins.some(coin => symbol.includes(coin));
}

function filterLeverages(pairsArray) {
  return pairsArray.filter(p => !p.includes('UPUSDT') && !p.includes('DOWNUSDT'));
}

function watchPrices(watchTickersList) {
  if (!watchTickersList || !watchTickersList.length) {
    console.log('🔴', `No tickers specified to watch. BB`);
    return;
  }

  binance.websockets.trades(watchTickersList, trades => {
    let { s: symbol, p: priceStr } = trades;
    const price = Number(priceStr);

    if (pendingTransactions[symbol] || transactionInProgress) {
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
      // New bottom price
      referencePrices[symbol] = price;
      // console.info(`${symbol} - ${price}, 🔻`);
      return;
    }

    if (price > refPrice && hasFundsToBuy()) {
      const percentageUp = price / refPrice - 1;
      // console.info(`${symbol} - ${price}, 🟢 ${percentageUp}%`);

      if (percentageUp >= UP_TRIGGER_LEVEL) {
        console.log('🟢', `${symbol} - Purchase level reached - up ${percentageUp * 100}%`);
        startTransaction(symbol);
        buy(symbol, price);
      }
    }
  });
}

function hasFundsToBuy() {
  const hasFunds = Number(balances.USDT.available) >= SINGLE_TRANSACTION_USD_AMOUNT;
  return hasFunds;
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

    console.log('💰', `${symbol} - Purchased - qty: ${resp.executedQty} price: ${approxPrice}`);
    setStopLoss(symbol, approxPrice, resp.executedQty);
  } catch (e) {
    console.log('🔴', `${symbol} - Failed to buy`);
    finishTransaction(symbol);
    logResponseError(e);
  }
}

async function setStopLoss(symbol, approxPrice, quantity) {
  const existingStopLoss = stopLossOrders[symbol];
  let sellQuantity = quantity || existingStopLoss?.qty;
  let nextLevel = existingStopLoss ? (existingStopLoss.lvl || 0) + 1 : 0;

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
  let price = roundPricePrecision(symbol, approxPrice - approxPrice * STOP_LOSS_PRICE_LEVEL);
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
      lvl: nextLevel,
      timestamp: new Date().getTime(),
      price,
      stopPrice
    };
    referencePrices[symbol] = stopPrice;

    console.log(
      '🟡',
      `${symbol} - Stop loss set - qty: ${sellQuantity} stopPrice: ${stopPrice} sellPrice: ${price}`
    );
  } catch (e) {
    logResponseError(e);
  } finally {
    finishTransaction(symbol);
  }
}

function purchasedSymbolPriceUpdated(symbol, approxPrice) {
  const stopLoss = stopLossOrders[symbol];
  const updatedPrice = Number(approxPrice);

  if (updatedPrice > stopLoss.stopPrice) {
    const percentageUp = updatedPrice / stopLoss.price - 1;
    if (percentageUp > UP_TRIGGER_LEVEL + STOP_LOSS_PRICE_LEVEL) {
      startTransaction(symbol);
      console.log('🚀', `${symbol} - Price pump, increasing stop loss - price: ${approxPrice}`);
      setStopLoss(symbol, updatedPrice);
    }
  }

  if (updatedPrice < stopLoss.stopPrice) {
    i;
    liquidateStopLoss(symbol);
  }
}

async function liquidateStopLoss(symbol) {
  try {
    console.log('🔴', `${symbol} - Liquidating...`);
    const allOrders = await binance.openOrders(symbol);
    const openStopLossOrders = allOrders.filter(o => o.type === 'STOP_LOSS_LIMIT');

    if (openStopLossOrders.length) {
      console.log('🔴', `${symbol} - Trying to cancel existing stop loss...`);
      await binance.cancelAll(symbol);
      const quantity = roundQtyPrecision(symbol, stopLossOrders[symbol]?.qty);
      if (quantity) {
        console.log('🔴', `${symbol} - Manual market sell`);
        await binance.marketSell(symbol, quantity);
      }
    }
  } catch (e) {
    const error = getResponseError(e);
    if (error.code === -2011) {
      console.log('🔴', `${symbol} - Stop loss already executed`);
      return;
    }

    logResponseError(e);
  }

  await loadBalances();
  referencePrices[symbol] = stopLossOrders[symbol].stopPrice;
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

async function loadPrices() {
  prices = await binance.prices();
}

async function getBalance(symbol) {
  const coinSymbol = symbol.replace('USDT', '');
  await loadBalances();
  const balance = balances[coinSymbol];
  console.log('ℹ️ ', `${coinSymbol} - BALANCE`, balance);
  return balances[coinSymbol];
}

async function sellIdleSymbols() {
  console.log('ℹ️', `Checking for idle coins...`);
  const nowTimestamp = new Date().getTime();
  Object.entries(stopLossOrders).forEach(async ([symbol, data]) => {
    if (!data) {
      return;
    }

    const timeDiffMinutes = Math.floor((nowTimestamp - data.timestamp) / 1000 / 60);

    if (
      (timeDiffMinutes > IDLE_MINUTES_TRIGGER && data.lvl < 3) ||
      (timeDiffMinutes > IDLE_MINUTES_TRIGGER * 2 && data.lvl >= 3)
    ) {
      try {
        startTransaction(symbol);
        console.log('🔴', `${symbol} - Selling idle coin...`);
        await liquidateStopLoss(symbol);
      } catch (e) {
        console.log('🔴', `${symbol} - Error Selling idle coin...`);
        logResponseError(e);
      } finally {
        finishTransaction(symbol);
      }
    }
  });
}

async function watchIdle() {
  // Check every 5mins
  setInterval(() => sellIdleSymbols(), 1000 * 60 * 5);
}

async function loadAccountOrdersState() {
  const res = await binance.openOrders();
  const stopLosses = res
    .filter(o => o.type === 'STOP_LOSS_LIMIT')
    .filter(order => canTradePair(order.symbol));

  stopLosses.map(order => {
    stopLossOrders[order.symbol] = {
      id: order.orderId,
      qty: order.origQty,
      lvl: 0,
      timestamp: new Date().getTime(),
      price: order.price,
      stopPrice: order.stopPrice
    };
  });

  console.log('ℹ️ ', 'Loaded account orders', stopLossOrders);
}

function getResponseError(e) {
  if (e.body) {
    return JSON.parse(e.body);
  }

  return null;
}

function logResponseError(error) {
  const responseError = getResponseError(error);
  console.log('🔥 RES ERROR: ', `code: ${responseError.code}`, `message:${responseError.msg}`);
}

function finishTransaction(symbol) {
  pendingTransactions[symbol] = false;
  transactionInProgress = false;
}

function startTransaction(symbol) {
  pendingTransactions[symbol] = true;
  transactionInProgress = true;
}
