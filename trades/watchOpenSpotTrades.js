const { queueTransaction } = require('../transactions');
const { getSpotTrades } = require('./spotTrades');
const watchPrices = require('./watchPrices');

function watchOpenTrades(pairs) {
  const onPriceUpdate = (symbol, price) => {
    const openTrades = getSpotTrades();
    if (!openTrades[symbol]) {
      return;
    }

    // emergency sell if stop loss fails
    const config = openTrades[symbol];
    if (price < config.slSell) {
      queueTransaction('SL_SELL', config);
    }
  };

  watchPrices(pairs, onPriceUpdate);

  // account updates - sell / tp sell watch
}

module.exports = watchOpenTrades;
