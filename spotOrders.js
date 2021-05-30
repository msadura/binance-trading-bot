const binance = require('./binanceApi');
const { canTradePair } = require('./utils');

const stopLossOrders = {};

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

function getStopLossOrders() {
  return stopLossOrders;
}

module.exports = { loadAccountOrdersState, getStopLossOrders };
