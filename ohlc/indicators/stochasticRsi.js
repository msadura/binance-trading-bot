const extractDataByProperty = require('../extractData');
const StochasticRSI = require('technicalindicators').StochasticRSI;
const { roundPricePrecision } = require('../../utils');

function stochasticRSI(ohlcArray, { checkAll, symbol } = {}) {
  const candlesCount = ohlcArray.length;
  if (candlesCount < 14) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  const prices = extractDataByProperty(ohlcArray, 'close');
  const formatPriceFn = price => roundPricePrecision(symbol, price);
  const data = StochasticRSI.calculate({
    values: prices,
    format: formatPriceFn,
    rsiPeriod: 14,
    stochasticPeriod: 14,
    kPeriod: 3,
    dPeriod: 3
  });

  if (!data.length) {
    return updatedOhlc;
  }

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    lastCandle.stochasticRSI = data.pop();
  } else {
    data.reverse().forEach((sRsi, i) => {
      const candle = updatedOhlc[candlesCount - 1 - i];
      candle.stochasticRSI = sRsi;
    });
  }

  return updatedOhlc;
}

module.exports = stochasticRSI;
