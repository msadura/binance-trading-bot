const pendingTransactions = {};
let transactionInProgress = false;

function finishTransaction(symbol) {
  pendingTransactions[symbol] = false;
  transactionInProgress = false;
}

function startTransaction(symbol) {
  pendingTransactions[symbol] = true;
  transactionInProgress = true;
}

function hasPendingTransaction(symbol = '') {
  return pendingTransactions[symbol] || transactionInProgress;
}

module.exports = {
  finishTransaction,
  startTransaction,
  hasPendingTransaction
};
