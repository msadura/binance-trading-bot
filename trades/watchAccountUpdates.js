const { setUSDTBalance } = require('../balances');
const binance = require('../binanceApi');
const { addTradeToReport } = require('./report');
const { getSpotTrades, updateTrade } = require('./spotTrades');

function watchAccountUpdates() {
  // The only time the user data (account balances) and order execution websockets will fire,
  //is if you create or cancel an order, or an order gets filled or partially filled

  function balanceUpdate(data) {
    for (let obj of data.B) {
      let { a: asset, f: available, l: onOrder } = obj;
      if (asset === 'USDT') {
        setUSDTBalance({ available, onOrder });
      }
    }
  }

  function executionUpdate(data) {
    let {
      x: executionType,
      s: symbol,
      // p: orderPrice,
      // q: quantity,
      S: side,
      o: orderType,
      // i: orderId,
      // X: orderStatus,
      L: executedPrice
    } = data;
    if (executionType == 'NEW') {
      return;
    }

    const openTrades = getSpotTrades();
    const openTrade = openTrades[symbol];

    // console.log(
    //   '🔥 SOCKET TRADE UPDATE:',
    //   `${symbol} - side: ${side}, order type: ${orderType}, execution type: ${executionType}`
    // );
    if (openTrade) {
      //update market purchase price
      if (side === 'BUY' && executionType === 'TRADE' && orderType === 'MARKET') {
        const updatedTrade = { ...openTrade, openPrice: executedPrice };
        updateTrade(symbol, updatedTrade);
      }

      //update market purchase price
      if (side === 'SELL' && executionType === 'TRADE' && orderType === 'MARKET') {
        addTradeToReport(openTrade, executedPrice, 'idle');
        updateTrade(symbol, null);
      }

      // sell oco tp
      if (side === 'SELL' && executionType === 'TRADE' && orderType === 'LIMIT_MAKER') {
        addTradeToReport(openTrade, executedPrice, 'win');
        updateTrade(symbol, null);
      }

      // sell sl qq
      if (side === 'SELL' && executionType === 'TRADE' && orderType === 'STOP_LOSS_LIMIT') {
        addTradeToReport(openTrade, executedPrice, 'loss');
        updateTrade(symbol, null);
      }
    } else {
      // TODO - load account open trades to refresh list
    }
  }

  binance.websockets.userData(balanceUpdate, executionUpdate);
}

module.exports = watchAccountUpdates;
