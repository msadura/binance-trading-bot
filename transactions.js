const { buySpot, setOCOSell, setStopLoss, closePositionMarket } = require('./trades/spotTrades');

const pendingTransactions = {};
let transactionInProgress = false;

const transactionQueue = {
  TRADE_ORDER: [],
  POST_TRADE_ORDER: [],
  TP_SELL: [],
  CLOSE_POSITION: []
};

function finishTransaction(symbol) {
  pendingTransactions[symbol] = false;
  transactionInProgress = false;

  nextTransaction();
}

function startTransaction(symbol) {
  pendingTransactions[symbol] = true;
  transactionInProgress = true;
}

function hasPendingTransaction(symbol = '') {
  return pendingTransactions[symbol] || transactionInProgress;
}

function queueTransaction(type, config) {
  if (!type || !config) {
    return;
  }

  transactionQueue[type].push(config);
  nextTransaction();
}

async function nextTransaction(force) {
  if (transactionInProgress && !force) {
    return;
  }

  const next = getNextTransaction();

  if (!next) {
    return;
  }

  startTransaction();
  await runTransation(next.type, next.config);
  finishTransaction();
}

function getNextTransaction() {
  // sorted by priorities
  // POST_TRADE_ORDER sets stop losses and tp so it has highest priority
  if (transactionQueue.POST_TRADE_ORDER.length) {
    return { type: 'POST_TRADE_ORDER', config: transactionQueue.POST_TRADE_ORDER.shift() };
  }

  if (transactionQueue.CLOSE_POSITION.length) {
    return { type: 'CLOSE_POSITION', config: transactionQueue.CLOSE_POSITION.shift() };
  }

  if (transactionQueue.TP_SELL.length) {
    return { type: 'TP_SELL', config: transactionQueue.TP_SELL.shift() };
  }

  if (transactionQueue.TRADE_ORDER.length) {
    return { type: 'TRADE_ORDER', config: transactionQueue.TRADE_ORDER.shift() };
  }
}

async function runTransation(type, config, retries = 0) {
  try {
    const action = getActionForType(type, config);
    if (action) {
      await action();
    }
  } catch (e) {
    console.log('🔥 transaction error:', e);
    if (retries < 3) {
      retries = retries + 1;
      runTransation(type, config, retries + 1);
    } else {
      console.log('🔴', `${type} - Transaction failed, trying fallback action. Config:`, config);
      fallbackAction(type, config);
    }
  }
}

function getActionForType(type, config) {
  switch (type) {
    case 'TRADE_ORDER': {
      //spot buy default, add support for futures
      return async () => {
        const postTradeOrderConfig = await buySpot(config);
        queueTransaction('POST_TRADE_ORDER', postTradeOrderConfig);
      };
    }

    case 'POST_TRADE_ORDER': {
      //add support for futures
      if (config.tpSell) {
        return async () => setOCOSell(config);
      } else {
        return async () => setStopLoss(config);
      }
    }

    case 'CLOSE_POSITION': {
      return () => closePositionMarket(config);
    }

    case 'TP_SELL': {
      return () => closePositionMarket(config, true);
    }

    default:
      return null;
    // rest of types
  }
}

function fallbackAction(type, config) {
  switch (type) {
    case 'TRADE_ORDER': {
      //spot buy default, add support for futures
      return null;
    }

    case 'POST_TRADE_ORDER': {
      queueTransaction('CLOSE_POSITION', config);
      return;
    }

    default:
      return null;
    // rest of types
  }
}

module.exports = {
  finishTransaction,
  startTransaction,
  hasPendingTransaction,
  queueTransaction
};
