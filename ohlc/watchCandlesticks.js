const binance = require('../binanceApi');

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
      open,
      high,
      low,
      close,
      volume,
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
