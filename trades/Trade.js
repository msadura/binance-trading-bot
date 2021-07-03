const { queueTransaction } = require('../transactions');

const { getSpotTrades, loadAccountOrdersState } = require('./spotTrades');
const watchOpenSpotTrades = require('./watchOpenSpotTrades');
const { VIRTUAL_TRADES } = require('../constants');
const virtualTrades = require('./virtualTrades');

class Trade {
  // SPOT | FUTURES | MARGIN | VIRTUAL
  constructor(tradingType = 'SPOT') {
    if (!tradingType) {
      throw 'Specify trading type: SPOT | FUTURES';
    }

    this.tradingType = tradingType;
  }

  tradingType = null;

  async loadOpenTrades(riskRewardRatio) {
    let loadAction = loadAccountOrdersState;

    if (this.tradingType === 'FUTURES') {
      // @TODO: futures load etc.
    }

    await loadAction(riskRewardRatio);
  }

  closePosition(config) {
    if (!config.symbol) {
      console.warn('Trying to close position without specified symbol');
    }

    if (VIRTUAL_TRADES) {
      virtualTrades.closePosition(config, 'MANUAL_SELL');
      return;
    }

    queueTransaction('CLOSE_POSITION', config);
  }

  openPosition(config) {
    if (!config.symbol) {
      console.warn('Trying to open position without specified symbol');
    }

    if (VIRTUAL_TRADES) {
      virtualTrades.openPosition(config);
      return;
    }

    queueTransaction('TRADE_ORDER', config);
  }

  updatePosition(config) {
    if (!config.symbol) {
      console.warn('Trying to update position without specified symbol');
    }

    if (VIRTUAL_TRADES) {
      virtualTrades.updatePosition(config);
      return;
    }

    queueTransaction('POST_TRADE_ORDER', config);
  }

  watchIdle(maxIdleMinutes, idleCheckMinutes) {
    // Check every idleCheckMinutes mins
    setInterval(() => this.sellIdle(maxIdleMinutes), 1000 * 60 * idleCheckMinutes);
  }

  watchOpenTrades(watchPairs, config) {
    let watchAction = watchOpenSpotTrades;

    if (this.tradingType === 'FUTURES') {
      // @TODO: futures load etc.
    }

    if (VIRTUAL_TRADES) {
      watchAction = virtualTrades.watchOpenPositions;
    }

    watchAction(watchPairs, config);
  }

  async sellIdle(maxIdleMinutes = 60) {
    console.log('ℹ️', `Checking for idle coins...`);
    const nowTimestamp = new Date().getTime();

    Object.entries(this.openTrades).forEach(async ([symbol, data]) => {
      if (!data) {
        return;
      }

      const timeDiffMinutes = Math.floor((nowTimestamp - data.timestamp) / 1000 / 60);

      if (timeDiffMinutes > maxIdleMinutes) {
        console.log('🔴', `${symbol} - Selling idle coin...`);
        this.closePosition(data);
      }
    });
  }

  get openTrades() {
    let getTradesAction = getSpotTrades;

    if (this.tradingType === 'FUTURES') {
      // @TODO: futures
    }

    if (VIRTUAL_TRADES) {
      getTradesAction = virtualTrades.getOpenPositions;
    }

    return getTradesAction();
  }
}

module.exports = Trade;
