const Strategy = require('./Strategy');
const { roundPricePrecision } = require('../utils');
const ema = require('../ohlc/indicators/ema');
const stochasticRSI = require('../ohlc/indicators/stochasticRsi');
const atr = require('../ohlc/indicators/atr');
const { CANDLE_PERIOD } = require('../constants');

const PRICE_UPDATE_RANGE_RATIO = 1; // 0,5 * atr
// const RSI_OVERBOUGHT_VALUE = 80;
// const RSI_OVERSOLD_VALUE = 20;

class EmaStochRsiAtrStrategy extends Strategy {
  config = {
    riskRewardRatio: 0.67,
    stopLossSellRatio: 0.005, // for stop-limit orders (spot)
    watchPairs: {
      bestVolumeCount: 150,
      withLeverages: false
    },
    candlePeriod: CANDLE_PERIOD || '1h',
    maxIdleMinutes: 60 * 24,
    idleCheckMinutes: 60,
    usePriceUpdate: false,
    traceMarketStatus: true,
    logOpenPositionsReport: true
  };

  addIndicators(ohlcArray, { symbol, checkAll } = {}) {
    let data = [...ohlcArray];
    data = ema(data, { period: 50, symbol, checkAll });
    data = ema(data, { period: 14, symbol, checkAll });
    data = ema(data, { period: 8, symbol, checkAll });

    data = stochasticRSI(data, { checkAll, symbol });
    data = atr(data, { checkAll });

    return data;
  }

  isLongSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    const prevCandle = ohlc[ohlc.length - 2];
    const { ema } = candle;

    if (candle.close < ema[8]) {
      return false;
    }

    //stoch rsi cross
    // prev.k < prev.d && k > d
    if (
      prevCandle.stochasticRSI.k > prevCandle.stochasticRSI.d ||
      candle.stochasticRSI.k < candle.stochasticRSI.d
    ) {
      return false;
    }

    //stoch rsi under OVERSOLD area
    // const avgSRSI =
    //   (prevCandle.stochasticRSI.k +
    //     prevCandle.stochasticRSI.d +
    //     candle.stochasticRSI.k +
    //     candle.stochasticRSI.d) /
    //   4;

    // if (avgSRSI > RSI_OVERSOLD_VALUE) {
    //   console.log('🔥', `${symbol} - LONG SIGNAL, price: ${candle.close}, NO RSI Extreme`);
    //   return false;
    // }

    const emaOrder = ema[8] > ema[14] && ema[14] > ema[50];
    if (!emaOrder) {
      return false;
    }

    // all conditions met! We've got a long signal
    return true;
  }

  isShortSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    const prevCandle = ohlc[ohlc.length - 2];
    const { ema } = candle;

    if (candle.close > ema[8]) {
      return;
    }

    //stoch rsi cross
    // prev.k > prev.d && k < d
    if (
      prevCandle.stochasticRSI.k < prevCandle.stochasticRSI.d ||
      candle.stochasticRSI.k > candle.stochasticRSI.d
    ) {
      return false;
    }

    const emaOrder = ema[8] < ema[14] && ema[14] < ema[50];
    if (!emaOrder) {
      return false;
    }

    //stoch rsi under OVERSOLD area
    // const avgSRSI =
    //   (prevCandle.stochasticRSI.k +
    //     prevCandle.stochasticRSI.d +
    //     candle.stochasticRSI.k +
    //     candle.stochasticRSI.d) /
    //   4;

    // if (avgSRSI < RSI_OVERBOUGHT_VALUE) {
    //   console.log('🔥', `${symbol} - SHORT SIGNAL, price: ${candle.close}, NO RSI Extr`);
    //   return false;
    // }

    // all conditions met! We've got a long signal
    return true;
  }

  isCloseLongPositionSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    if (!candle.ema) {
      return false;
    }

    const { ema } = candle;
    if (ema[8] < ema[14] || ema[14] < ema[50]) {
      return true;
    }

    return false;
  }

  isCloseShortPositionSignal(ohlc) {
    const candle = ohlc[ohlc.length - 1];
    if (!candle.ema) {
      return false;
    }

    const { ema } = candle;
    if (ema[8] > ema[14] || ema[14] > ema[50]) {
      return true;
    }

    return false;
  }

  getPriceLevelsForLong(symbol, { currentPrice, priceRange, priceUpdate = false }) {
    const slRange = priceRange * 3;
    const slStop = roundPricePrecision(symbol, currentPrice - slRange);
    const slSell = roundPricePrecision(symbol, slStop - slStop * this.config.stopLossSellRatio);
    const tpSell = roundPricePrecision(
      symbol,
      currentPrice + slRange * this.config.riskRewardRatio
    );
    const refPrice = roundPricePrecision(symbol, currentPrice);
    const priceUpdateRange = priceRange * PRICE_UPDATE_RANGE_RATIO;

    const prices = { slStop, slSell, tpSell, refPrice, priceUpdateRange };
    if (!priceUpdate) {
      prices.openPrice = refPrice;
    }

    return prices;
  }

  getPriceLevelsForShort(symbol, { currentPrice, priceRange, priceUpdate = false }) {
    const slRange = priceRange * 3;
    const slStop = roundPricePrecision(symbol, currentPrice + slRange);
    const slSell = roundPricePrecision(symbol, slStop + slStop * this.config.stopLossSellRatio);
    const tpSell = roundPricePrecision(
      symbol,
      currentPrice - slRange * this.config.riskRewardRatio
    );
    const refPrice = roundPricePrecision(symbol, currentPrice);
    const priceUpdateRange = priceRange * PRICE_UPDATE_RANGE_RATIO;

    const prices = { slStop, slSell, tpSell, refPrice, priceUpdateRange };
    if (!priceUpdate) {
      prices.openPrice = refPrice;
    }

    return prices;
  }

  getLongPriceUpdateConfig(trade, price) {
    // console.log('🔥', 'check price update', trade.symbol, price);
    if (trade.refPrice >= price) {
      return null;
    }

    const { refPrice, symbol, tpSell } = trade;
    const tpRange = tpSell - refPrice;
    // price reached 50% to tp
    if (tpRange > 0 && price > refPrice + tpRange / 2) {
      // sl level on previous ref
      const slStopUpdated = refPrice;
      const slSellUpdated = roundPricePrecision(
        symbol,
        slStopUpdated - slStopUpdated * this.config.stopLossSellRatio
      );
      // increace tpSell
      const tpSellUpdated = roundPricePrecision(symbol, tpSell + tpRange);

      const updatedPrices = {
        slStop: slStopUpdated,
        slSell: slSellUpdated,
        tpSell: tpSellUpdated,
        refPrice: price
      };

      return { ...trade, ...updatedPrices };
    }
  }
}

module.exports = EmaStochRsiAtrStrategy;
