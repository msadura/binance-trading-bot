function williamsFractals(ohlcArray) {
  const candlesCount = ohlcArray.length;
  if (candlesCount < 6) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  const n = candlesCount - 3;

  const candlesSet = {
    'n-2': ohlcArray[n - 2],
    'n-1': ohlcArray[n - 1],
    n: ohlcArray[n],
    'n+1': ohlcArray[n + 1],
    'n+2': ohlcArray[n + 2]
  };

  updatedOhlc[n].isBearishFractal = isBearishFractal(candlesSet);
  updatedOhlc[n].isBullishFractal = isBullishFractal(candlesSet);

  return updatedOhlc;
}

function isBullishFractal(candlesSet) {
  // Bullish Fractal=
  // Low(N)<Low(N−2) and
  // Low(N)<Low(N−1) and
  // Low(N)<Low(N+1) and
  // Low(N)<Low(N+2)

  return (
    candlesSet.n.low < candlesSet['n-2'].low &&
    candlesSet.n.low < candlesSet['n-1'].low &&
    candlesSet.n.low < candlesSet['n+1'].low &&
    candlesSet.n.low < candlesSet['n+2'].low
  );
}

function isBearishFractal(candlesSet) {
  // Bearish Fractal=
  // High(N)>High(N−2) and
  // High(N)>High(N−1) and
  // High(N)>High(N+1) and
  // High(N)>High(N+2)

  return (
    candlesSet.n.high > candlesSet['n-2'].low &&
    candlesSet.n.high > candlesSet['n-1'].low &&
    candlesSet.n.high > candlesSet['n+1'].low &&
    candlesSet.n.high > candlesSet['n+2'].low
  );
}

module.exports = williamsFractals;
