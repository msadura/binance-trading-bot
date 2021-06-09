const binance = require('./binanceApi');

let filters;
let requestLimits = {};

async function loadExchangeInfo() {
  const resp = await binance.exchangeInfo();
  setRequestLimits(resp.rateLimits);

  let minimums = {};
  for (let obj of resp.symbols) {
    let filters = { status: obj.status };
    for (let filter of obj.filters) {
      if (filter.filterType == 'MIN_NOTIONAL') {
        filters.minNotional = filter.minNotional;
      } else if (filter.filterType == 'PRICE_FILTER') {
        filters.minPrice = filter.minPrice;
        filters.maxPrice = filter.maxPrice;
        filters.tickSize = filter.tickSize;
      } else if (filter.filterType == 'LOT_SIZE') {
        filters.stepSize = filter.stepSize;
        filters.minQty = filter.minQty;
        filters.maxQty = filter.maxQty;
      }
    }
    //filters.baseAssetPrecision = obj.baseAssetPrecision;
    //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
    filters.orderTypes = obj.orderTypes;
    filters.icebergAllowed = obj.icebergAllowed;
    minimums[obj.symbol] = filters;
  }

  filters = minimums;
}

function getFilters() {
  if (!filters) {
    throw 'Filters not loaded';
  }

  return filters;
}

function setRequestLimits(rateLimits) {
  rateLimits?.forEach(l => (requestLimits[l.rateLimitType] = l));
}

function getRequestLimits(type) {
  return requestLimits[type];
}

module.exports = {
  getFilters,
  loadExchangeInfo,
  getRequestLimits
};
