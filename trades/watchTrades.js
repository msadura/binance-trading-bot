const binance = require('../binanceApi');

function watchTrades(watchPairs, onTrades) {
  if (!watchPairs) {
    console.log('🔴', `No pairs specified to watch for trades`);
    return;
  }

  binance.websockets.trades(watchPairs, onTrades);
}

module.exports = watchTrades;
