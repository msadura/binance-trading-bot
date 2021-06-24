const { hasFundsToBuy } = require('./balances');
const { SINGLE_TRANSACTION_USD_AMOUNT } = require('./constants');
const getWatchPairs = require('./getWatchPairs');
const ema = require('./ohlc/indicators/ema');
const { loadCandlesForSymbols } = require('./ohlc/loadCandles');
const { addOhlcPair, setOhlcData } = require('./ohlc/ohlcCache');
const watchCandlesticks = require('./ohlc/watchCandlesticks');
const { queueTransaction } = require('./transactions');
const { roundPricePrecision } = require('./utils');
const watchAccountUpdates = require('./trades/watchAccountUpdates');
const watchOpenSpotTrades = require('./trades/watchOpenSpotTrades');
const { getSpotTrades, watchIdle } = require('./trades/spotTrades');
const stochasticRSI = require('./ohlc/indicators/stochasticRsi');
const atr = require('./ohlc/indicators/atr');

const STOP_LOSS_SELL_RATIO = 0.005;
const CANDLE_PERIOD = '1h';

async function watchEmaStochRsiAtrStrategy() {
  const watchPairs = await getWatchPairs({ withLeverages: true, highVolume: true });
  // const watchPairs = [
  //   'ETCUSDT',
  //   'MATICUSDT',
  //   'RUNEUSDT',
  //   'BTCUSDT',
  //   'DOGEUSDT',
  //   'SXPUSDT',
  //   'FTMUSDT',
  //   'SOLUSDT',
  //   'UNIUSDT',
  //   'AVAXUSDT',
  //   'ATOMUSDT',
  //   'SRMUSDT',
  //   'CRVUSDT'
  // ];
  // const watchPairs = ['MATICUSDT'];

  await prepareHistoricalOhlcData(watchPairs);

  const onCandle = (symbol, data) => {
    let ohlc = addOhlcPair(symbol, data);
    ohlc = addIndicators(ohlc, { checkAll: false, symbol });
    ohlc = addOhlcPair(symbol, ohlc);

    checkForTradeSignal(symbol, ohlc);
  };

  watchCandlesticks({ callback: onCandle, period: CANDLE_PERIOD, pairs: watchPairs });
  watchAccountUpdates();
  watchOpenSpotTrades(watchPairs);
  watchIdle(config => queueTransaction('SL_SELL', config), 60 * 5);
}

function checkForTradeSignal(symbol, ohlc) {
  const openTrades = getSpotTrades();
  if (openTrades.symbol) {
    return;
  }

  const lastCandle = ohlc[ohlc.length - 1];
  const prevCandle = ohlc[ohlc.length - 2];

  const updatePriceConfig = getPriceUpdateConfig(symbol, lastCandle);
  if (updatePriceConfig) {
    console.log('🔥', `${symbol} - SL / TP Level update`);
    queueTransaction('POST_TRADE_ORDER', updatePriceConfig);
    return;
  }

  const isLong = isLongSignal(lastCandle, prevCandle);
  if (isLong) {
    const prices = getPriceUpdateConfig(symbol, lastCandle);
    if (hasFundsToBuy(SINGLE_TRANSACTION_USD_AMOUNT)) {
      // console.log('🔥', 'GOT TRADE SIGNAL!', { symbol, ...prices });
      // console.log('🔥 candle', lastCandle);
      queueTransaction('TRADE_ORDER', { symbol, ...prices });
    }
  }
}

function isLongSignal(candle, prevCandle) {
  const { ema } = candle;

  if (candle.close < ema[8]) {
    return;
  }

  if (ema[8] < ema[14] || ema[14] < ema[50]) {
    return false;
  }

  //stoch rsi cross
  // prev.k < prev.d && k > d
  if (
    prevCandle.stochasticRSI.k > prevCandle.stochasticRSI.d ||
    candle.stochasticRSI.k < candle.stochasticRSI.d
  ) {
    return false;
  }

  // all conditions met! We've got a long signal
  return true;
}

function getPriceUpdateConfig(symbol, candle) {
  const openTrades = getSpotTrades();
  const trade = openTrades[symbol];
  if (!trade) {
    return;
  }

  if (trade.side === 'BUY') {
    return getLongPriceUpdateConfig(trade, candle);
  }
}

function getLongPriceUpdateConfig(symbol, lastCandle) {
  const { close: currentPrice, atr } = lastCandle;

  const slStop = roundPricePrecision(symbol, currentPrice - atr * 3);
  const slSell = roundPricePrecision(symbol, slStop - slStop * STOP_LOSS_SELL_RATIO);
  const tpSell = roundPricePrecision(symbol, currentPrice + atr * 2);
  const refPrice = roundPricePrecision(symbol, currentPrice);

  return { slStop, slSell, tpSell, refPrice };
}

async function prepareHistoricalOhlcData(watchPairs) {
  let ohlcData = await loadCandlesForSymbols(watchPairs, CANDLE_PERIOD);

  watchPairs.forEach(pair => {
    // add needed indicators to ohlc data
    ohlcData[pair] = addIndicators(ohlcData[pair], { checkAll: true, symbol: pair });
  });

  // console.log('🔥 data:', ohlcData);

  setOhlcData(ohlcData);
}

function addIndicators(ohlcArray, { symbol, checkAll } = {}) {
  let data = [...ohlcArray];
  data = ema(data, { period: 50, symbol, checkAll });
  data = ema(data, { period: 14, symbol, checkAll });
  data = ema(data, { period: 8, symbol, checkAll });

  data = stochasticRSI(data, { checkAll, symbol });
  data = atr(data, { checkAll });
  //atr
  //stoch rsi

  return data;
}

module.exports = watchEmaStochRsiAtrStrategy;
