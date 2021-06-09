const binance = require('../binanceApi');
const { canTradePair } = require('../utils');

const openTrades = {};

async function loadAccountOrdersState() {
  const res = await binance.openOrders();
  const stopLosses = res
    .filter(o => o.type === 'STOP_LOSS_LIMIT')
    .filter(order => canTradePair(order.symbol));

  stopLosses.map(order => {
    openTrades[order.symbol] = {
      id: order.orderId,
      qty: order.origQty,
      lvl: 0,
      timestamp: new Date().getTime(),
      price: order.price,
      stopPrice: order.stopPrice
    };
  });

  console.log('ℹ️ ', 'Loaded account orders', openTrades);
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

module.exports = { loadAccountOrdersState, getSpotTrades, getTradeForSymbol, updateTrade };
