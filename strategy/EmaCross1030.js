const Strategy = require('./Strategy');
const { roundPricePrecision } = require('../utils');
const ema = require('../ohlc/indicators/ema');
const atr = require('../ohlc/indicators/atr');
const macd = require('../ohlc/indicators/macd');

class EmaCross1030 extends Strategy {
  config = {
    riskRewardRatio: 3,
    stopLossSellRatio: 0.005, // for stop-limit orders (spot)
    watchPairs: {
      bestVolumeCount: 150,
      withLeverages: false
    },
    candlePeriod: '30m',
    maxIdleMinutes: 60 * 24,
    idleCheckMinutes: 60,
    usePriceUpdate: false,
    traceMarketStatus: true
  };

  addIndicators(ohlcArray, { symbol, checkAll } = {}) {
    let data = [...ohlcArray];
    data = ema(data, { period: 10, symbol, checkAll });
    data = ema(data, { period: 30, symbol, checkAll });
    data = atr(data, { checkAll });
    data = macd(data, { symbol, checkAll });

    return data;
  }

  isLongSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    const prevCandle = ohlc[ohlc.length - 2];
    const { ema } = candle;

    if (ema[10] < ema[30]) {
      return false;
    }

    // macd: MACD - green, signal - red
    if (candle.macd.MACD <= candle.macd.signal) {
      return false;
    }

    // long - ema cross
    // prev[ema10] < prev[ema30] && ema[10] > ema[30]
    if (prevCandle.ema[10] < prevCandle.ema[30]) {
      return true;
    }

    return false;
  }

  isShortSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    const prevCandle = ohlc[ohlc.length - 2];
    const { ema } = candle;

    if (ema[10] > ema[30]) {
      return false;
    }

    // macd: MACD - green, signal - red
    if (candle.macd.MACD >= candle.macd.signal) {
      return false;
    }

    // prev[ema10] > prev[ema30] && ema[10] < ema[30]
    if (prevCandle.ema[10] > prevCandle.ema[30]) {
      return true;
    }

    return false;
  }

  isCloseLongPositionSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    if (!candle.ema) {
      return false;
    }

    // if (candle.ema[10] < candle.ema[30]) {
    //   return true;
    // }

    return false;
  }

  isCloseShortPositionSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    if (!candle.ema) {
      return false;
    }

    // if (candle.ema[10] > candle.ema[30]) {
    //   return true;
    // }

    return false;
  }

  getPriceLevelsForLong(symbol, { currentPrice, priceRange, priceUpdate = false }) {
    const slRange = priceRange * 1;
    const slStop = roundPricePrecision(symbol, currentPrice - slRange);
    const slSell = roundPricePrecision(symbol, slStop - slStop * this.config.stopLossSellRatio);
    const tpSell = roundPricePrecision(
      symbol,
      currentPrice + slRange * this.config.riskRewardRatio
    );
    const refPrice = roundPricePrecision(symbol, currentPrice);
    const priceUpdateRange = priceRange * 1;

    const prices = { slStop, slSell, tpSell, refPrice, priceUpdateRange };
    if (!priceUpdate) {
      prices.openPrice = refPrice;
    }

    return prices;
  }

  // price range = atr
  getPriceLevelsForShort(symbol, { currentPrice, priceRange, priceUpdate = false }) {
    const slRange = priceRange * 1;
    const slStop = roundPricePrecision(symbol, currentPrice + slRange);
    const slSell = roundPricePrecision(symbol, slStop + slStop * this.config.stopLossSellRatio);
    const tpSell = roundPricePrecision(
      symbol,
      currentPrice - slRange * this.config.riskRewardRatio
    );
    const refPrice = roundPricePrecision(symbol, currentPrice);
    const priceUpdateRange = priceRange * 1;

    const prices = { slStop, slSell, tpSell, refPrice, priceUpdateRange };
    if (!priceUpdate) {
      prices.openPrice = refPrice;
    }

    return prices;
  }
}

module.exports = EmaCross1030;
