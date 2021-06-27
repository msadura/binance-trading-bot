const { queueTransaction } = require('../transactions');
const { getSpotTrades } = require('./spotTrades');
const watchPrices = require('./watchPrices');

function watchOpenTrades(pairs, { priceUpdateCb } = {}) {
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

    priceUpdateCb?.(symbol, price);
  };

  watchPrices(pairs, onPriceUpdate);
}

module.exports = watchOpenTrades;
