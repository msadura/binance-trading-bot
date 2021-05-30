const { hasFundsToBuy, getBalance } = require('./balances');
const binance = require('./binanceApi');
const { SINGLE_TRANSACTION_USD_AMOUNT } = require('./constants');
const { getStopLossOrders } = require('./spotOrders');
const { hasPendingTransaction, startTransaction, finishTransaction } = require('./transactions');
const { logResponseError, getResponseError } = require('./errorHandler');
const { roundQtyPrecision, roundPricePrecision } = require('./utils');
const getWatchPairs = require('./getWatchPairs');
const { loadBalances } = './balances';

const referencePrices = {};
const UP_TRIGGER_LEVEL = 0.03;
const STOP_LOSS_TRIGGER_LEVEL = 0.06;
const STOP_LOSS_PRICE_LEVEL = 0.065;
const IDLE_MINUTES_TRIGGER = 30;

function watchLivePricesStrategy() {
  const watchPairs = getWatchPairs();

  watchPrices(watchPairs);
  watchIdle();
}

function watchPrices(watchTickersList) {
  if (!watchTickersList || !watchTickersList.length) {
    console.log('🔴', `No tickers specified to watch. BB`);
    return;
  }

  binance.websockets.trades(watchTickersList, trades => {
    let { s: symbol, p: priceStr } = trades;
    const price = Number(priceStr);

    if (hasPendingTransaction()) {
      return;
    }
    const stopLossOrders = getStopLossOrders();
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

    if (price > refPrice && hasFundsToBuy(SINGLE_TRANSACTION_USD_AMOUNT)) {
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

function purchasedSymbolPriceUpdated(symbol, approxPrice) {
  const stopLossOrders = getStopLossOrders();
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
    liquidateStopLoss(symbol);
  }
}

async function setStopLoss(symbol, approxPrice, quantity) {
  const stopLossOrders = getStopLossOrders();
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

async function liquidateStopLoss(symbol) {
  try {
    console.log('🔴', `${symbol} - Liquidating...`);
    const allOrders = await binance.openOrders(symbol);
    const openStopLossOrders = allOrders.filter(o => o.type === 'STOP_LOSS_LIMIT');

    if (openStopLossOrders.length) {
      console.log('🔴', `${symbol} - Trying to cancel existing stop loss...`);
      await binance.cancelAll(symbol);

      const stopLossOrders = getStopLossOrders();
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
  const stopLossOrders = getStopLossOrders();
  referencePrices[symbol] = stopLossOrders[symbol].stopPrice;
  stopLossOrders[symbol] = null;
  finishTransaction(symbol);
  console.log('🔴', `${symbol} - Stop loss triggered`);
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

// async function testSell(symbol, quantity) {
//   try {
//     const resp = await binance.marketSell(symbol, quantity);
//     debugger;
//   } catch (e) {
//     logResponseError(e);
//     debugger;
//   }
// }

function getAmountToBuy(symbol, approxPrice) {
  const amount = SINGLE_TRANSACTION_USD_AMOUNT / Number(approxPrice);
  return roundQtyPrecision(symbol, amount);
}

async function sellIdleSymbols() {
  console.log('ℹ️', `Checking for idle coins...`);
  const nowTimestamp = new Date().getTime();
  const stopLossOrders = getStopLossOrders();
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

module.exports = { watchLivePricesStrategy };
