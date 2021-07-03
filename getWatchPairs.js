const uniq = require('lodash/uniq');

const binance = require('./binanceApi');
const { getFilters } = require('./exchangeInfo');
const { canTradePair } = require('./utils');

const DEFAULT_CONFIG = { withLeverages: false, bestVolumeCount: 50 };
const MARKET_STATUS_PAIRS_COUNT = 200;

let pairsWithVolumes = [];

async function getWatchPairs(config, traceMarketStatus) {
  if (!config) {
    console.warn('Get watch pairs config not passed, using default one.');
  }
  const configObj = config || DEFAULT_CONFIG;
  const { withLeverages, bestVolumeCount, manualWatchPairs, extraWatchPairs = [] } = configObj;

  let USDTPairs = Object.keys(getFilters()).filter(p => p.endsWith('USDT'));
  let watchPairs = null;

  if (traceMarketStatus) {
    watchPairs = await filterHighVolume(USDTPairs, MARKET_STATUS_PAIRS_COUNT);
  }

  if (manualWatchPairs?.length) {
    return { tradePairs: uniq([...manualWatchPairs, ...extraWatchPairs]), watchPairs };
  }

  // some of down coin charts acts weird
  USDTPairs = filterDown(USDTPairs);

  if (!withLeverages) {
    USDTPairs = filterUp(USDTPairs);
  }

  USDTPairs = USDTPairs.filter(p => canTradePair(p));

  if (bestVolumeCount) {
    USDTPairs = await filterHighVolume(USDTPairs, bestVolumeCount);
  }

  return { tradePairs: uniq([...USDTPairs, ...extraWatchPairs]), watchPairs };
}

function filterUp(pairsArray) {
  return pairsArray.filter(p => !p.includes('UPUSDT'));
}

function filterDown(pairsArray) {
  return pairsArray.filter(p => !p.includes('DOWNUSDT'));
}

async function filterHighVolume(pairsArray, bestVolumeCount) {
  if (!pairsWithVolumes?.length) {
    const resp = await binance.prevDay(false);

    resp.forEach(({ symbol, quoteVolume }) => {
      // volumesObj[symbol] = Number(quoteVolume))
      pairsWithVolumes.push({
        symbol,
        volume: quoteVolume || 0
      });
    });

    pairsWithVolumes.sort((a, b) => b.volume - a.volume);
  }

  const allowedPairs = pairsWithVolumes.filter(p => pairsArray.includes(p.symbol));
  // x best coins
  return allowedPairs.slice(0, bestVolumeCount).map(item => item.symbol);
}

module.exports = getWatchPairs;
