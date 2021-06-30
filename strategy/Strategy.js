const Trade = require('../trades/Trade');
const getWatchPairs = require('../getWatchPairs');
const { loadCandlesForSymbols } = require('../ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('../ohlc/ohlcCache');
const watchCandlesticks = require('../ohlc/watchCandlesticks');
const watchAccountUpdates = require('../trades/watchAccountUpdates');

const DEFAULT_STRATEGY_CONFIG = {
  riskRewardRatio: 1,
  stopLossSellRatio: 0.005, // for stop-limit orders (spot)
  watchPairs: {
    bestVolumeCount: 150,
    withLeverages: false
  },
  candlePeriod: '1h',
  maxIdleMinutes: 60 * 24,
  idleCheckMinutes: 60,
  usePriceUpdate: false
};

class Strategy {
  constructor(config) {
    this.config = config;
  }

  config = null;
  trade = null;
  watchPairs = [];

  async run(tradingType) {
    if (!this.config) {
      throw 'Stragety config is not set!';
    }

    this.trade = new Trade(tradingType);

    await this.trade.loadOpenTrades(this.config.riskRewardRatio);
    this.watchPairs = await getWatchPairs(this.config.watchPairs);
    await this.prepareHistoricalOhlcData();

    watchCandlesticks({
      callback: this.onCandle,
      period: this.config.candlePeriod,
      pairs: this.watchPairs
    });
    watchAccountUpdates();

    this.trade.watchOpenTrades(this.watchPairs, {
      priceUpdateCb: this.config.usePriceUpdate ? this.onPriceUpdate : null
    });

    if (this.config.maxIdleMinutes) {
      this.trade.watchIdle(
        this.config.maxIdleMinutes,
        this.config.idleCheckMinutes || DEFAULT_STRATEGY_CONFIG.idleCheckMinutes
      );
    }
  }

  async prepareHistoricalOhlcData() {
    if (!this.config.candlePeriod) {
      throw 'config.candlePeriod not set!';
    }

    let ohlcData = await loadCandlesForSymbols(this.watchPairs, this.config.candlePeriod);

    this.watchPairs.forEach(pair => {
      // add needed indicators to ohlc data
      ohlcData[pair] = this.addIndicators(ohlcData[pair], { checkAll: true, symbol: pair });
    });

    setOhlcData(ohlcData);
  }

  getPriceUpdateConfig(symbol, price) {
    const trade = this.trade.openTrades[symbol];
    if (!trade) {
      return;
    }

    if (trade.side === 'BUY') {
      return this.getLongPriceUpdateConfig(trade, price);
    }
  }

  getLongPriceUpdateConfig(trade, price) {
    if (trade.refPrice >= price) {
      return null;
    }

    const { refPrice, priceUpdateRange, symbol } = trade;
    if (price > refPrice + priceUpdateRange) {
      const updatedPrices = this.getPriceLevelsForLong(symbol, {
        currentPrice: price,
        priceRange: priceUpdateRange
      });

      return { ...trade, ...updatedPrices };
    }
  }

  onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = this.addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);

    this.checkForTradeSignal(symbol, ohlc);
  };

  // eslint-disable-next-line no-unused-vars
  addIndicators(ohlcArray, { symbol, checkAll } = {}) {
    throw 'Required strategy method addIndicators not implemented!';
  }

  // eslint-disable-next-line no-unused-vars
  checkForTradeSignal(symbol, ohlcArray) {
    throw 'Required strategy method checkForTradeSignal not implemented!';
  }

  // eslint-disable-next-line no-unused-vars
  getPriceLevelsForLong(symbol, { currentPrice, priceRange }) {
    throw 'Required strategy method getPriceLevelsForLong not implemented!';
  }

  // eslint-disable-next-line no-unused-vars
  onPriceUpdate(symbol, price) {
    // Implement onPriceUpdate if you want to make updates based on existing order price update
  }
}

module.exports = Strategy;
