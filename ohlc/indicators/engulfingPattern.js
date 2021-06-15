// var twoDayBullishInput = {
//   open: [23.25,15.36],
//   high: [25.10,30.87],
//   close: [21.44,27.89],
//   low: [20.82,14.93],
// }

function engulfingPattern(ohlcArray, { period = 14, checkAll } = {}) {
  const candlesCount = ohlcArray.length;
  if (!period || candlesCount < period) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];

  if (!checkAll) {
    const lastCandle = updatedOhlc[candlesCount - 1];
    const prevCandle = updatedOhlc[candlesCount - 2];
    lastCandle.isBullishEngulfing = isBullishEngulfing(lastCandle, prevCandle);
    lastCandle.isBearishEngulfing = isBearishEngulfing(lastCandle, prevCandle);
  } else {
    updatedOhlc.forEach((candle, i) => {
      if (i === 0) {
        return;
      }

      const prevCandle = updatedOhlc[i - 1];
      candle.isBullishEngulfing = isBullishEngulfing(candle, prevCandle);
      candle.isBearishEngulfing = isBearishEngulfing(candle, prevCandle);
    });
  }

  return updatedOhlc;
}

function isBullishEngulfing(candle, prevCandle) {
  // tradeview script HarryPotter
  // open[1] > close[1] ? close > open ? close >= open[1] ? close[1] >= open ? close - open > open[1] - close[1]
  const isBullishPattern =
    prevCandle.open > prevCandle.close &&
    candle.close > candle.open &&
    candle.close >= prevCandle.open &&
    prevCandle.close >= candle.open &&
    candle.close - candle.open > prevCandle.open - prevCandle.close;

  return isBullishPattern;
}

function isBearishEngulfing(candle, prevCandle) {
  // TODO - get formula from tradeview
  return false;
}

module.exports = engulfingPattern;
