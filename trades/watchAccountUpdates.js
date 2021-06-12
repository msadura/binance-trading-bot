const binance = require('../binanceApi');
import { addTradeToReport } from './report';
const { getSpotTrades, updateTrade } = require('./spotTrades');

function watchAccountUpdates() {
  // The only time the user data (account balances) and order execution websockets will fire,
  //is if you create or cancel an order, or an order gets filled or partially filled

  function balanceUpdate(data) {
    for (let obj of data.B) {
      let { a: asset, f: available, l: onOrder } = obj;
      // update usdt
      if (available == '0.00000000') continue;
      console.log(asset + '\tavailable: ' + available + ' (' + onOrder + ' on order)');
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
      i: orderId,
      // X: orderStatus,
      L: executedPrice
    } = data;
    if (executionType == 'NEW') {
      return;
    }

    const openTrades = getSpotTrades();
    const openTrade = openTrades[symbol];
    if (openTrade) {
      //update market purchase price
      if (side === 'BUY' && executionType === 'TRADE' && orderType === 'MARKET') {
        const updatedTrade = { ...openTrade, refPrice: executedPrice };
        updateTrade(symbol, updatedTrade);
      }

      // sell oco tp
      if (side === 'SELL' && executionType === 'TRADE' && orderType === 'LIMIT_MAKER') {
        addTradeToReport(openTrade, executedPrice, true);
      }

      // sell sl qq
      if (side === 'SELL' && executionType === 'TRADE' && orderType === 'STOP_LOSS_LIMIT') {
        addTradeToReport(openTrade, executedPrice, false);
      }
    }

    //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
    console.log(
      symbol + '\t' + side + ' ' + executionType + ' ' + orderType + ' ORDER #' + orderId
      // tp sell:
      //ETHUSDT	SELL TRADE LIMIT_MAKER ORDER #4590956796

      //sl sell
      //ETHUSDT	SELL TRADE STOP_LOSS_LIMIT ORDER #4591220541
    );
    console.log('🔥 data', executedPrice);
  }

  binance.websockets.userData(balanceUpdate, executionUpdate);
}

module.exports = watchAccountUpdates;
