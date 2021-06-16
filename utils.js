const binance = require('./binanceApi');
const { BLOCKED_TRADE_COINS } = require('./constants');
const { getFilters, getRequestLimits } = require('./exchangeInfo');

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
  const blocked = [...BLOCKED_TRADE_COINS, 'EURUSDT', 'USDCUSDT', 'GBPUSDT', 'BUSDUSDT'];
  return !blocked.some(coin => symbol.includes(coin));
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function logUsedRequestsLimit() {
  const usedLimit = await binance.usedWeight();
  console.log(
    'ℹ️',
    `used binance requests limit: ${usedLimit} / ${getRequestLimits('REQUEST_WEIGHT')?.limit}`
  );
}

module.exports = {
  roundQtyPrecision,
  roundPricePrecision,
  canTradePair,
  sleep,
  logUsedRequestsLimit
};
