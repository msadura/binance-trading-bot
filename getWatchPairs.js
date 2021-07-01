const binance = require('./binanceApi');
const { getFilters } = require('./exchangeInfo');
const { canTradePair } = require('./utils');

const DEFAULT_CONFIG = { withLeverages: false, bestVolumeCount: 50 };

async function getWatchPairs(config) {
  if (!config) {
    console.warn('Get watch pairs config not passed, using default one.');
  }
  const configObj = config || DEFAULT_CONFIG;
  const { withLeverages, bestVolumeCount, manulaWatchPairs } = configObj;

  if (manulaWatchPairs?.length) {
    return manulaWatchPairs;
  }

  let USDTPairs = Object.keys(getFilters()).filter(p => p.endsWith('USDT'));
  // some of down coin charts acts weird
  USDTPairs = filterDown(USDTPairs);

  if (!withLeverages) {
    USDTPairs = filterUp(USDTPairs);
  }

  if (bestVolumeCount) {
    USDTPairs = await filterHighVolume(USDTPairs, bestVolumeCount);
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

async function filterHighVolume(pairsArray, bestVolumeCount) {
  const resp = await binance.prevDay(false);
  const volumesObj = {};
  resp.map(({ symbol, quoteVolume }) => (volumesObj[symbol] = Number(quoteVolume)));

  const pairsWithVolumes = pairsArray.map(symbol => ({
    symbol,
    volume: volumesObj[symbol] || 0
  }));
  pairsWithVolumes.sort((a, b) => b.volume - a.volume);
  // x best coins
  return pairsWithVolumes.slice(0, bestVolumeCount).map(item => item.symbol);
}

module.exports = getWatchPairs;
