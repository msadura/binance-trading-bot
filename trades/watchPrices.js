const watchTrades = require('./watchTrades');

function watchPrices(watchPairs, callback) {
  const onTrades = trades => {
    let { s: symbol, p: priceStr } = trades;
    const price = Number(priceStr);
    callback(symbol, price);
  };

  watchTrades(watchPairs, onTrades);
}

module.exports = watchPrices;
