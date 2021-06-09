const { MANUAL_WATCH_PAIRS } = require('./constants');
const { getFilters } = require('./exchangeInfo');
const { canTradePair } = require('./utils');

function getWatchPairs(withLeverages = false) {
  if (MANUAL_WATCH_PAIRS.length) {
    return MANUAL_WATCH_PAIRS;
  }

  let USDTPairs = Object.keys(getFilters()).filter(p => p.includes('USDT'));
  if (!withLeverages) {
    USDTPairs = filterLeverages(USDTPairs);
  }
  const USDTPairsFiltered = USDTPairs.filter(p => canTradePair(p));

  return USDTPairsFiltered;
}

function filterLeverages(pairsArray) {
  return pairsArray.filter(p => !p.includes('UPUSDT') && !p.includes('DOWNUSDT'));
}

module.exports = getWatchPairs;
