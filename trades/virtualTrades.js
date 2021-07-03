const { SINGLE_TRADE_USD_AMOUNT, MAX_OPEN_TRADES } = require('../constants');
const { roundQtyPrecision } = require('../utils');
const { addTradeToReport } = require('./report');
const { loadSymbolPrice } = require('../prices');
const watchPrices = require('./watchPrices');

const openTrades = {};

function getOpenPositions() {
  return openTrades;
}

function updatePosition(symbol, tradeData = null) {
  openTrades[symbol] = tradeData;
}

function getPositionForSymbol(symbol) {
  return openTrades[symbol];
}

function getAmountToBuy(symbol, refPrice) {
  const amount = SINGLE_TRADE_USD_AMOUNT / Number(refPrice);
  return roundQtyPrecision(symbol, amount);
}

function getOpenTradesCount() {
  return Object.values(openTrades).filter(Boolean).length;
}

async function openPosition(config) {
  const { symbol, refPrice, side } = config;

  if (openTrades[symbol] || (MAX_OPEN_TRADES && getOpenTradesCount() >= MAX_OPEN_TRADES)) {
    return;
  }

  const quantity = getAmountToBuy(symbol, refPrice);
  const tradeOrderConfig = { ...config };
  tradeOrderConfig.quantity = quantity;
  tradeOrderConfig.timestamp = new Date().getTime();

  console.log(
    '💰',
    `${symbol} - Virtual purchase... - qty: ${quantity} price: ${refPrice} side: ${side}`
  );

  openTrades[symbol] = tradeOrderConfig;
}

// type SL_SELL | MANUAL_SELL | TP_SELL
async function closePosition(config, type, price) {
  if (!config || !config.symbol || !openTrades[config.symbol]) {
    return;
  }

  let executedPrice = price;
  if (!price) {
    executedPrice = await loadSymbolPrice(config.symbol);
  }

  openTrades[config.symbol] = null;

  switch (type) {
    case 'SL_SELL': {
      addTradeToReport(config, executedPrice, 'loss');
      return;
    }

    case 'MANUAL_SELL': {
      addTradeToReport(config, executedPrice, 'manual');
      return;
    }

    case 'TP_SELL': {
      addTradeToReport(config, executedPrice, 'win');
      return;
    }
  }
}

function watchOpenPositions(pairs, { priceUpdateCb } = {}) {
  const onPriceUpdate = (symbol, price) => {
    if (!openTrades[symbol]) {
      return;
    }

    const config = openTrades[symbol];
    if (price < config.slSell && config.side === 'BUY') {
      closePosition(config, 'SL_SELL', price);
    }

    if (price > config.tpSell && config.side === 'BUY') {
      closePosition(config, 'TP_SELL', price);
    }

    if (price > config.slSell && config.side === 'SELL') {
      closePosition(config, 'SL_SELL', price);
    }

    if (price < config.tpSell && config.side === 'SELL') {
      closePosition(config, 'TP_SELL', price);
    }

    priceUpdateCb?.(symbol, price);
  };

  watchPrices(pairs, onPriceUpdate);
}

module.exports = {
  getOpenPositions,
  updatePosition,
  getPositionForSymbol,
  openPosition,
  closePosition,
  watchOpenPositions
};
