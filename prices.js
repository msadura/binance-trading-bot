const binance = require('./binanceApi');

let prices = {};

async function loadPrices() {
  prices = await binance.prices();
}

function getPrices() {
  return prices;
}

module.exports = { loadPrices, getPrices };
