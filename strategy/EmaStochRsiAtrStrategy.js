const Strategy = require('./Strategy');
const { roundPricePrecision } = require('../utils');
const ema = require('../ohlc/indicators/ema');
const stochasticRSI = require('../ohlc/indicators/stochasticRsi');
const atr = require('../ohlc/indicators/atr');

const PRICE_UPDATE_RANGE_RATIO = 1; // 0,5 * atr

class EmaStochRsiAtrStrategy extends Strategy {
  config = {
    riskRewardRatio: 0.67,
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

  addIndicators(ohlcArray, { symbol, checkAll } = {}) {
    let data = [...ohlcArray];
    data = ema(data, { period: 50, symbol, checkAll });
    data = ema(data, { period: 14, symbol, checkAll });
    data = ema(data, { period: 8, symbol, checkAll });

    data = stochasticRSI(data, { checkAll, symbol });
    data = atr(data, { checkAll });

    return data;
  }

  isLongSignal(ohlc, symbol) {
    const candle = ohlc[ohlc.length - 1];
    const prevCandle = ohlc[ohlc.length - 2];
    const { ema } = candle;

    if (candle.close < ema[8]) {
      return;
    }

    //stoch rsi cross
    // prev.k < prev.d && k > d
    if (
      prevCandle.stochasticRSI.k > prevCandle.stochasticRSI.d ||
      candle.stochasticRSI.k < candle.stochasticRSI.d
    ) {
      return false;
    }

    const emaOrder = ema[8] > ema[14] && ema[14] > ema[50];
    if (!emaOrder) {
      return false;
    } else {
      console.log(`${symbol} - EMA ORDER: ${ema[8]} > ${ema[14]} > ${ema[50]}`);
      console.log(ohlc);
    }

    // all conditions met! We've got a long signal
    return true;
  }

  isShortSignal(ohlc, symbol) {
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
    } else {
      console.log(`${symbol} - EMA ORDER: ${ema[8]} < ${ema[14]} < ${ema[50]}`);
      console.log(ohlc);
    }

    // all conditions met! We've got a long signal
    return true;
  }

  isCloseLongPositionSignal(ohlc, symbol) {
    const candle = ohlc[ohlc.length - 1];
    if (!candle.ema) {
      return false;
    }

    const { ema } = candle;
    if (ema[8] < ema[14] || ema[14] < ema[50]) {
      return true;
    } else {
      console.log(`${symbol} - EMA ORDER (exiting): ${ema[8]} > ${ema[14]} > ${ema[50]}`);
    }

    return false;
  }

  getPriceLevelsForLong(symbol, { currentPrice, priceRange }) {
    const slRange = priceRange * 3;
    const slStop = roundPricePrecision(symbol, currentPrice - slRange);
    const slSell = roundPricePrecision(symbol, slStop - slStop * this.config.stopLossSellRatio);
    const tpSell = roundPricePrecision(
      symbol,
      currentPrice + slRange * this.config.riskRewardRatio
    );
    const refPrice = roundPricePrecision(symbol, currentPrice);
    const priceUpdateRange = priceRange * PRICE_UPDATE_RANGE_RATIO;

    return { slStop, slSell, tpSell, refPrice, priceUpdateRange };
  }

  // eslint-disable-next-line no-unused-vars
  onPriceUpdate(symbol, price) {
    // const updatePriceConfig = this.getPriceUpdateConfig(symbol, price);
    // if (updatePriceConfig) {
    //   console.log('🔥', `${symbol} - SL / TP Level update`);
    //   queueTransaction('POST_TRADE_ORDER', updatePriceConfig);
    //   return true;
    // }
  }
}

module.exports = EmaStochRsiAtrStrategy;
