const binance = require('../binanceApi');
const { logResponseError, getResponseError } = require('../errorHandler');
const { canTradePair, roundPricePrecision } = require('../utils');
const { SINGLE_TRADE_USD_AMOUNT, MAX_OPEN_TRADES } = require('../constants');
const { roundQtyPrecision } = require('../utils');
const { getBalance, loadBalances, hasFundsToBuy } = require('../balances');

const openTrades = {};
const IDLE_MINUTES_TRIGGER = 60;

async function loadAccountOrdersState(riskRewartRatio) {
  const res = await binance.openOrders();

  //map also sell orders (oco)
  const orders = res
    // .filter(o => o.type === 'STOP_LOSS_LIMIT')
    .filter(order => canTradePair(order.symbol));
  orders.map(order => {
    if (!openTrades[order.symbol]) {
      openTrades[order.symbol] = {
        timestamp: new Date().getTime()
      };
    }

    switch (order.type) {
      case 'STOP_LOSS_LIMIT': {
        openTrades[order.symbol] = {
          ...openTrades[order.symbol],
          slId: Number(order.orderId),
          quantity: Number(order.origQty),
          slSell: Number(order.price),
          slStop: Number(order.stopPrice),
          symbol: order.symbol,
          side: 'BUY'
        };

        break;
      }

      case 'LIMIT_MAKER': {
        openTrades[order.symbol] = {
          ...openTrades[order.symbol],
          tpId: order.orderId,
          quantity: Number(order.origQty),
          tpSell: Number(order.price),
          side: 'BUY'
        };

        break;
      }
    }
  });

  if (riskRewartRatio) {
    Object.keys(openTrades).forEach(k => {
      const ratio = 1 + riskRewartRatio;
      const { tpSell, slStop, symbol } = openTrades[k];
      const diff = tpSell - slStop;
      const refPrice = slStop + diff / ratio;
      if (refPrice) {
        openTrades[k].refPrice = roundPricePrecision(symbol, refPrice);
      }
    });
  }

  console.log('ℹ️ ', 'Loaded account trades:');
  Object.values(openTrades).forEach(o => {
    console.log(JSON.stringify(o));
  });
}

function getSpotTrades() {
  return openTrades;
}

function updateTrade(symbol, tradeData = null) {
  openTrades[symbol] = tradeData;
}

function getTradeForSymbol(symbol) {
  return openTrades[symbol];
}

function getAmountToBuy(symbol, refPrice) {
  const amount = SINGLE_TRADE_USD_AMOUNT / Number(refPrice);
  return roundQtyPrecision(symbol, amount);
}

function getOpenTradesCount() {
  return Object.values(openTrades).filter(Boolean).length;
}

async function buySpot(config) {
  const { symbol, refPrice } = config;

  if (
    !config ||
    !hasFundsToBuy(SINGLE_TRADE_USD_AMOUNT) ||
    openTrades[symbol] ||
    (MAX_OPEN_TRADES && getOpenTradesCount() >= MAX_OPEN_TRADES)
  ) {
    return;
  }

  const quantity = getAmountToBuy(symbol, refPrice);
  const postTradeOrderConfig = { ...config };
  postTradeOrderConfig.quantity = quantity;
  postTradeOrderConfig.timestamp = new Date().getTime();

  console.log('💰', `${symbol} - Purchasing... - qty: ${quantity} price: ${refPrice}`);

  const resp = await binance.marketBuy(symbol, quantity);
  postTradeOrderConfig.quantity = resp.executedQty;
  console.log('💰', `${symbol} - Purchased - qty: ${resp.executedQty} price: ${refPrice}`);

  await loadBalances();
  openTrades[symbol] = postTradeOrderConfig;

  return postTradeOrderConfig;

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
}

async function cancelCurrentOrders(symbol) {
  const openTrades = getSpotTrades();
  const openTrade = openTrades[symbol];

  if (openTrade) {
    console.log('🟡', `${symbol} - cancelling existing orders`);
    try {
      await binance.cancelAll(symbol);
    } catch (e) {
      const responseError = getResponseError(e);
      if (responseError.code === -2011) {
        // Does not have open trades
        return;
      } else {
        logResponseError(e);
      }
    }
  }
}

async function setStopLoss(config) {
  if (!config) {
    return;
  }
  const { symbol, quantity, slStop, slSell, testTrade } = config;
  const openTrades = getSpotTrades();
  const openTrade = openTrades[symbol];
  let slQuantity = quantity || openTrade?.qty;

  if (openTrade && openTrade.slId && !testTrade) {
    await cancelCurrentOrders(symbol);
  }

  if (!testTrade) {
    const balance = await getBalance(symbol);
    const availableToSell = roundQtyPrecision(symbol, balance.available);
    if (Number(availableToSell) === 0) {
      //Stop loss probably triggered already
      console.log('🟡', `${symbol} - No balance available - skipping stop loss order`);
      openTrades[symbol] = null;
    }

    if (slQuantity && slQuantity > availableToSell) {
      slQuantity = availableToSell;
    }
  }

  let type = 'STOP_LOSS_LIMIT';

  console.log(
    '🟡',
    `${symbol} - Setting stop loss... - qty: ${slQuantity} stopPrice: ${slStop} sellPrice: ${slSell}`
  );

  let resp;
  if (!config.testTrade) {
    resp = await binance.sell(symbol, slQuantity, slSell, {
      stopPrice: slStop,
      type: type
    });

    console.log(
      '🟡',
      `${symbol} - Stop loss set - qty: ${slQuantity} stopPrice: ${slStop} sellPrice: ${slSell}`
    );
  }

  openTrades[symbol] = {
    ...config,
    slId: resp?.orderId || null,
    quantity: slQuantity,
    timestamp: new Date().getTime()
  };
}

async function setOCOSell(config) {
  if (!config) {
    return;
  }
  const { testTrade, symbol, quantity, tpSell, slStop, slSell } = config;
  const ocoConfig = { ...config };

  await cancelCurrentOrders(symbol);

  if (!testTrade) {
    try {
      const res = await binance.sell(symbol, quantity, tpSell, {
        type: 'OCO',
        stopLimitPrice: slSell,
        stopPrice: slStop
      });

      ocoConfig.slId = res.orderReports.find(o => o.type === 'STOP_LOSS_LIMIT')?.orderId;
      ocoConfig.tpId = res.orderReports.find(o => o.type === 'LIMIT_MAKER')?.orderId;

      console.log(
        '🟡',
        `${symbol} - OCO sell order set - qty: ${quantity} stopPrice: ${slStop} sellPrice: ${slSell} tpPrice: ${tpSell}`
      );
    } catch (e) {
      logResponseError(e);
    }

    openTrades[symbol] = ocoConfig;
  }
}

async function closePositionMarket(config, isTpSell) {
  if (!config) {
    return;
  }
  const { symbol, quantity } = config;
  try {
    if (isTpSell) {
      //@TODO: path for manual tp sell - not needed for now
      console.log('🔥', '@TODO: path for manual tp sell');
    } else {
      console.log('🔴', `${symbol} - Liquidating...`);
    }
    const allOrders = await binance.openOrders(symbol);
    const openStopLossOrders = allOrders.filter(o => o.type === 'STOP_LOSS_LIMIT');

    if (openStopLossOrders.length && quantity) {
      console.log('🔴', `${symbol} - Trying to cancel existing stop loss...`);
      await binance.cancelAll(symbol);
    }

    if (quantity) {
      console.log('🔴', `${symbol} - Manual market sell`);
      await binance.marketSell(symbol, quantity);
    }
  } catch (e) {
    const error = getResponseError(e);

    if (error.code === -2011) {
      console.log('🔴', `${symbol} - Stop loss already executed`);
      return;
    } else {
      throw e;
    }
  }

  // quick qorkaoround - give socket time to update trade
  setTimeout(() => {
    openTrades[symbol] = null;
  }, 1000);

  await loadBalances();
  console.log('🔴', `${symbol} - trade manually liquidated`);
}

async function sellIdleSymbols(onIdleCallback, idleTime = IDLE_MINUTES_TRIGGER) {
  console.log('ℹ️', `Checking for idle coins...`);
  const nowTimestamp = new Date().getTime();
  const openOrders = getSpotTrades();
  Object.entries(openOrders).forEach(async ([symbol, data]) => {
    if (!data) {
      return;
    }

    const timeDiffMinutes = Math.floor((nowTimestamp - data.timestamp) / 1000 / 60);

    if (timeDiffMinutes > idleTime) {
      console.log('🔴', `${symbol} - Selling idle coin...`);
      onIdleCallback(data);
    }
  });
}

async function watchIdle(onIdleCallback) {
  // Check every 15mins
  setInterval(() => sellIdleSymbols(onIdleCallback), 1000 * 60 * 15);
}

module.exports = {
  loadAccountOrdersState,
  getSpotTrades,
  getTradeForSymbol,
  updateTrade,
  buySpot,
  setStopLoss,
  setOCOSell,
  closePositionMarket,
  watchIdle
};
