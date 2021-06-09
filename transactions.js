const pendingTransactions = {};
let transactionInProgress = false;

const transactionQueue = {
  buy: [],
  tpSell: [],
  slSell: []
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

function queueTransaction(type, data) {
  if (!type || !data) {
    return;
  }

  transactionQueue[type].push(data);
  nextTransaction();
}

function nextTransaction() {
  if (transactionInProgress) {
    return;
  }

  startTransaction();
  // pick next transaction and do stuff, finish at the end
}

module.exports = {
  finishTransaction,
  startTransaction,
  hasPendingTransaction,
  queueTransaction
};
