const Trade = require('../trades/Trade');
const getWatchPairs = require('../getWatchPairs');
const { loadCandlesForSymbols } = require('../ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('../ohlc/ohlcCache');
const watchCandlesticks = require('../ohlc/watchCandlesticks');
const watchAccountUpdates = require('../trades/watchAccountUpdates');
const { openPositionsReport } = require('../trades/report');

const DEFAULT_STRATEGY_CONFIG = {
  riskRewardRatio: 1,
  stopLossSellRatio: 0.005, // for stop-limit orders (spot)
  watchPairs: {
    bestVolumeCount: 150,
    withLeverages: false,
    manualWatchPairs: [],
    extraWatchPairs: []
  },
  candlePeriod: '1h',
  maxIdleMinutes: 60 * 24,
  idleCheckMinutes: 60,
  usePriceUpdate: false,
  traceMarketStatus: true,
  logOpenPositionsReport: true
};

class Strategy {
  constructor(config) {
    this.config = config;
  }

  config = null;
  trade = null;
  watchPairs = [];
  tradePairs = [];

  async run(tradingType) {
    if (!this.config) {
      throw 'Stragety config is not set!';
    }

    this.trade = new Trade(tradingType);

    await this.trade.loadOpenTrades(this.config.riskRewardRatio);
    const extraWatchPairs = Object.keys(this.trade.openTrades);
    let watchPairsConfig = this.config.watchPairs ? this.config.watchPairs : {};
    watchPairsConfig = { ...watchPairsConfig, extraWatchPairs };

    const { tradePairs, watchPairs } = await getWatchPairs(
      watchPairsConfig,
      this.config.traceMarketStatus
    );

    this.tradePairs = tradePairs;
    this.watchPairs = watchPairs || tradePairs;
    console.log('🔥', `${tradePairs.length} TRADE PAIRS: ${JSON.stringify(tradePairs)}`);

    await this.prepareHistoricalOhlcData();

    watchCandlesticks({
      callback: this.onCandle,
      period: this.config.candlePeriod,
      pairs: this.watchPairs
    });
    watchAccountUpdates();

    this.trade.watchOpenTrades(this.tradePairs, {
      priceUpdateCb: this.config.usePriceUpdate ? this.onPriceUpdate : null
    });

    if (this.config.maxIdleMinutes) {
      this.trade.watchIdle(
        this.config.maxIdleMinutes,
        this.config.idleCheckMinutes || DEFAULT_STRATEGY_CONFIG.idleCheckMinutes
      );
    }

    this.reportOpenPositions();
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

  checkForTradeSignal = (symbol, ohlc) => {
    const openTrades = this.trade.openTrades;
    const lastCandle = ohlc[ohlc.length - 1];
    const isTradeable = this.tradePairs.includes(symbol);

    if (openTrades[symbol]) {
      const shouldCloseLong =
        openTrades[symbol].side === 'BUY' && this.isCloseLongPositionSignal(ohlc, symbol);

      const shouldCloseShort =
        openTrades[symbol].side === 'SELL' && this.isCloseShortPositionSignal(ohlc, symbol);

      if (shouldCloseLong || shouldCloseShort) {
        this.trade.closePosition(openTrades[symbol]);
      }

      return;
    }

    const isLong = this.isLongSignal(ohlc, symbol);
    const isShort = this.isShortSignal(ohlc, symbol);
    // const isLong = false;
    // const isShort = false;

    if (!openTrades[symbol] && isLong) {
      const prices = this.getPriceLevelsForLong(symbol, {
        priceRange: lastCandle.atr,
        currentPrice: lastCandle.close
      });

      if (!isTradeable) {
        return;
      }

      this.trade.openPosition({ symbol, side: 'BUY', ...prices });
      return;
    }

    if (!openTrades[symbol] && isShort) {
      const prices = this.getPriceLevelsForShort(symbol, {
        priceRange: lastCandle.atr,
        currentPrice: lastCandle.close
      });

      if (!isTradeable) {
        return;
      }

      this.trade.openPosition({ symbol, side: 'SELL', ...prices });
    }
  };

  // eslint-disable-next-line no-unused-vars
  onPriceUpdate = (symbol, price) => {
    if (!this.config?.usePriceUpdate) {
      return;
    }

    const updatePriceConfig = this.getPriceUpdateConfig(symbol, price);
    if (updatePriceConfig) {
      console.log('🔥', `${symbol} - SL / TP Level update`);
      this.trade.updatePosition(updatePriceConfig);
      return true;
    }
  };

  getPriceUpdateConfig(symbol, price) {
    const trade = this.trade.openTrades[symbol];
    if (!trade) {
      return;
    }

    if (trade.side === 'BUY') {
      return this.getLongPriceUpdateConfig(trade, price);
    }

    //@TODO - handle short
  }

  getLongPriceUpdateConfig(trade, price) {
    if (trade.refPrice >= price) {
      return null;
    }

    const { refPrice, priceUpdateRange, symbol } = trade;
    if (priceUpdateRange && price > refPrice + priceUpdateRange) {
      const updatedPrices = this.getPriceLevelsForLong(symbol, {
        currentPrice: price,
        priceRange: priceUpdateRange,
        priceUpdate: true
      });

      return { ...trade, ...updatedPrices };
    }
  }

  reportOpenPositions() {
    if (!this.config?.logOpenPositionsReport) {
      return;
    }

    setInterval(() => openPositionsReport(this.trade.openTrades), 1000 * 60 * 15);
  }

  // eslint-disable-next-line no-unused-vars
  isCloseLongPositionSignal(ohlc, symbol) {
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  isCloseShortPositionSignal(ohlc, symbol) {
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  isLongSignal(ohlc) {
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  isShortSignal(ohlc) {
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  getPriceLevelsForLong(symbol, { currentPrice, priceRange }) {
    throw 'Required strategy method getPriceLevelsForLong not implemented!';
  }

  // eslint-disable-next-line no-unused-vars
  getPriceLevelsForShort(symbol, { currentPrice, priceRange }) {
    throw 'Required strategy method getPriceLevelsForShort not implemented!';
  }
}

module.exports = Strategy;
