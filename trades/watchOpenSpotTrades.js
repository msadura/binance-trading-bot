const { queueTransaction } = require('../transactions');
const { getSpotTrades } = require('./spotTrades');
const watchPrices = require('./watchPrices');

function watchOpenTrades(pairs, { priceUpdateCb } = {}) {
  const onPriceUpdate = (symbol, price) => {
    const openTrades = getSpotTrades();
    if (!openTrades[symbol]) {
      return;
    }

    //VIRTUAL_TRADES -> watch for trade tp / sl / update

    // emergency sell if stop loss fails
    const config = openTrades[symbol];
    if (price < config.slSell) {
      queueTransaction('CLOSE_POSITION', config);
    }

    priceUpdateCb?.(symbol, price);
  };

  watchPrices(pairs, onPriceUpdate);
}

module.exports = watchOpenTrades;
