const extractDataByProperty = require('../extractData');
const ATR = require('technicalindicators').ATR;

function atr(ohlcArray, { checkAll } = {}) {
  const candlesCount = ohlcArray.length;
  if (candlesCount < 14) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  const high = extractDataByProperty(ohlcArray, 'high');
  const low = extractDataByProperty(ohlcArray, 'low');
  const close = extractDataByProperty(ohlcArray, 'close');

  const data = ATR.calculate({
    period: 14,
    high,
    low,
    close
  });

  if (!data.length) {
    return updatedOhlc;
  }

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    lastCandle.atr = data.pop();
  } else {
    data.reverse().forEach((atr, i) => {
      const candle = updatedOhlc[candlesCount - 1 - i];
      candle.atr = atr;
    });
  }

  return updatedOhlc;
}

module.exports = atr;
