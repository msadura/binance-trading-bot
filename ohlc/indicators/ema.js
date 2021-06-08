const extractDataByProperty = require('../extractData');
const calculateEma = require('technicalindicators').ema;
const { roundPricePrecision } = require('../../utils');

function ema(ohlcArray, { period, checkAll, symbol } = {}) {
  const candlesCount = ohlcArray.length;
  if (!period || candlesCount < period) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  const prices = extractDataByProperty(ohlcArray, 'close');
  const formatPriceFn = price => roundPricePrecision(symbol, price);
  const emaData = calculateEma({ period: period, values: prices, format: formatPriceFn });

  if (!emaData.length) {
    return updatedOhlc;
  }

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    if (!lastCandle.ema) {
      lastCandle.ema = {};
    }
    lastCandle.ema[period] = emaData.pop();
  } else {
    emaData.reverse().forEach((emaPrice, i) => {
      const candle = updatedOhlc[candlesCount - 1 - i];
      if (!candle.ema) {
        candle.ema = {};
      }
      candle.ema[period] = emaPrice;
    });
  }

  return updatedOhlc;
}

module.exports = ema;
