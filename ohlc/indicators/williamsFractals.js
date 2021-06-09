let ca = false;
function williamsFractals(ohlcArray, { checkAll } = {}) {
  ca = checkAll;
  const candlesCount = ohlcArray.length;
  if (candlesCount < 6) {
    return ohlcArray;
  }

  const updatedOhlc = [...ohlcArray];
  if (checkAll) {
    updatedOhlc.forEach((o, n) => checkFractal(updatedOhlc, n));
  } else {
    const n = candlesCount - 3;
    checkFractal(updatedOhlc, n);
  }

  return updatedOhlc;
}

function checkFractal(ohlcArray, n) {
  if (n < 2 || n > ohlcArray.length - 3) {
    return;
  }

  const candlesSet = {
    'n-2': ohlcArray[n - 2],
    'n-1': ohlcArray[n - 1],
    n: ohlcArray[n],
    'n+1': ohlcArray[n + 1],
    'n+2': ohlcArray[n + 2]
  };

  ohlcArray[n].isBearishFractal = isBearishFractal(candlesSet);
  ohlcArray[n].isBullishFractal = isBullishFractal(candlesSet);

  if (!ca) {
    console.log('🔥 candle config', candlesSet);
    console.log('🔥 updated ohlc item', ohlcArray[n]);
    console.log('🔥 all items', ohlcArray);
  }
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
    candlesSet.n.high > candlesSet['n-2'].high &&
    candlesSet.n.high > candlesSet['n-1'].high &&
    candlesSet.n.high > candlesSet['n+1'].high &&
    candlesSet.n.high > candlesSet['n+2'].high
  );
}

module.exports = williamsFractals;
