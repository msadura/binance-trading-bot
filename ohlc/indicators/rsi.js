const extractDataByProperty = require('../extractData');
const calculateRsi = require('technicalindicators').rsi;
const { roundPricePrecision } = require('../../utils');

function rsi(ohlcArray, { period = 14, checkAll, symbol } = {}) {
  const candlesCount = ohlcArray.length;
  if (!period || candlesCount < period) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  const prices = extractDataByProperty(ohlcArray, 'close');
  const formatPriceFn = price => roundPricePrecision(symbol, price);
  const data = calculateRsi({ period: period, values: prices, format: formatPriceFn });

  if (!data.length) {
    return updatedOhlc;
  }

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    lastCandle.rsi = data.pop();
  } else {
    data.reverse().forEach((price, i) => {
      const candle = updatedOhlc[candlesCount - 1 - i];
      candle.rsi = price;
    });
  }

  return updatedOhlc;
}

module.exports = rsi;
