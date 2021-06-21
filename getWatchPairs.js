const binance = require('./binanceApi');
const { MANUAL_WATCH_PAIRS } = require('./constants');
const { getFilters } = require('./exchangeInfo');
const { canTradePair } = require('./utils');

async function getWatchPairs({ withLeverages, highVolume } = {}) {
  if (MANUAL_WATCH_PAIRS.length) {
    return MANUAL_WATCH_PAIRS;
  }

  let USDTPairs = Object.keys(getFilters()).filter(p => p.endsWith('USDT'));
  // some of down coin charts acts weird
  USDTPairs = filterDown(USDTPairs);

  if (!withLeverages) {
    USDTPairs = filterUp(USDTPairs);
  }

  if (highVolume) {
    USDTPairs = await filterHighVolume(USDTPairs);
  }

  const USDTPairsFiltered = USDTPairs.filter(p => canTradePair(p));

  return USDTPairsFiltered;
}

function filterUp(pairsArray) {
  return pairsArray.filter(p => !p.includes('UPUSDT'));
}

function filterDown(pairsArray) {
  return pairsArray.filter(p => !p.includes('DOWNUSDT'));
}

async function filterHighVolume(pairsArray) {
  const resp = await binance.prevDay(false);
  const volumesObj = {};
  resp.map(({ symbol, quoteVolume }) => (volumesObj[symbol] = Number(quoteVolume)));

  const pairsWithVolumes = pairsArray.map(symbol => ({
    symbol,
    volume: volumesObj[symbol] || 0
  }));
  pairsWithVolumes.sort((a, b) => b.volume - a.volume);
  // x best coins
  return pairsWithVolumes.slice(0, 150).map(item => item.symbol);
}

module.exports = getWatchPairs;
