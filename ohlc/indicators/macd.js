const extractDataByProperty = require('../extractData');
const MACD = require('technicalindicators').MACD;
const { roundPricePrecision } = require('../../utils');

function stochasticRSI(ohlcArray, { checkAll, symbol } = {}) {
  const candlesCount = ohlcArray.length;

  const updatedOhlc = [...ohlcArray];
  const prices = extractDataByProperty(ohlcArray, 'close');
  const formatPriceFn = price => roundPricePrecision(symbol, price);
  const data = MACD.calculate({
    values: prices,
    format: formatPriceFn,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  if (!data.length) {
    return updatedOhlc;
  }

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    lastCandle.macd = data.pop();
  } else {
    data.reverse().forEach((macd, i) => {
      const candle = updatedOhlc[candlesCount - 1 - i];
      candle.macd = macd;
    });
  }

  return updatedOhlc;
}

module.exports = stochasticRSI;
