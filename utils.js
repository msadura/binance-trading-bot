const binance = require('./binanceApi');
const { BLOCKED_TRADE_COINS } = require('./constants');
const { getFilters } = require('./filters');

function roundQtyPrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const filters = getFilters();
  const precision = filters[symbol]?.stepSize;
  return binance.roundStep(numToRound, precision);
}

function roundPricePrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const filters = getFilters();
  const precision = filters[symbol]?.tickSize;
  return binance.roundStep(numToRound, precision);
}

function canTradePair(symbol) {
  return !BLOCKED_TRADE_COINS.some(coin => symbol.includes(coin));
}

module.exports = { roundQtyPrecision, roundPricePrecision, canTradePair };
