const { roundPricePrecision } = require('../../utils');

function heikinAshi(ohlcArray, symbol) {
  if (!ohlcArray || ohlcArray.length === 0) {
    return [];
  }

  const ha = [];
  ohlcArray.forEeach((tick, i) => {
    const haCandle = { ...tick };
    // const tick = {
    //   open,
    //   high,
    //   low,
    //   close,
    //   volume,
    //   trades,
    //   interval,
    //   isFinal,
    //   quoteVolume,
    //   buyVolume,
    //   quoteBuyVolume
    // };

    // HA-Close = (Open(0) + High(0) + Low(0) + Close(0)) / 4
    haCandle.close = (tick.close + tick.high + tick.low + tick.close) / 4;
    haCandle.close = roundPricePrecision(symbol, haCandle.close);

    if (i > 0) {
      const prevHa = ha[i - 1];
      // HA-Open = (HA-Open(-1) + HA-Close(-1)) / 2
      haCandle.open = (prevHa.open + prevHa.close) / 2;
      haCandle.open = roundPricePrecision(symbol, haCandle.open);

      // HA-High = Maximum of the High(0), HA-Open(0) or HA-Close(0)
      haCandle.high = Math.max(tick.high, haCandle.open, haCandle.close);

      // HA-Low = Minimum of the Low(0), HA-Open(0) or HA-Close(0)
      haCandle.low = Math.min(tick.low, haCandle.open, haCandle.close);
    } else {
      haCandle.open = (tick.close + tick.open) / 2;
    }

    ha.push(haCandle);
  });

  return ha;
}

module.exports = heikinAshi;
