const binance = require('../binanceApi');
const { roundPricePrecision } = require('../utils');

function watchCandlesticks({ pairs, period = '1m', callback }) {
  binance.websockets.candlesticks(pairs, period, candlesticks => {
    let { k: ticks, s: symbol } = candlesticks;
    let {
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
      n: trades,
      i: interval,
      x: isFinal,
      q: quoteVolume,
      V: buyVolume,
      Q: quoteBuyVolume
    } = ticks;

    if (!isFinal) {
      return;
    }

    const ticksData = {
      volume: Number(volume),
      open: roundPricePrecision(symbol, open),
      high: roundPricePrecision(symbol, high),
      low: roundPricePrecision(symbol, low),
      close: roundPricePrecision(symbol, close),
      closeTime: new Date(),
      trades,
      interval,
      isFinal,
      quoteVolume,
      buyVolume,
      quoteBuyVolume
    };

    callback(symbol, ticksData);
  });
}

module.exports = watchCandlesticks;
