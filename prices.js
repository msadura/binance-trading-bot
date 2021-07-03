const binance = require('./binanceApi');

let prices = {};

async function loadPrices() {
  prices = await binance.prices();
}

function getPrices() {
  return prices;
}

async function loadSymbolPrice(symbol) {
  const res = await binance.prices(symbol);
  return Number(res[symbol]);
}

module.exports = { loadPrices, getPrices, loadSymbolPrice };
