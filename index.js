require('dotenv').config();
const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
  test: false
};

const BUY_TRIGGER_LEVEL = 6;
const STOP_LOSS_LEVEL = 3;
const SINGLE_TRANSACTION_USD_AMOUNT = 12;

if (process.env.USE_TESTNET) {
  config.urls = {
    // base: 'https://testnet.binance.vision/api/',
    // combineStream: 'wss://testnet.binance.vision/stream?streams=',
    // stream: 'wss://testnet.binance.vision/ws/'
  };
}

const binance = new Binance().options(config);
// list of all symbols to watch
const watchTickers = ['MATICBUSD'];
const referencePrices = {};
const stopLossOrders = {};
let filters;
let balances;

function watchPrices() {
  binance.websockets.trades(watchTickers, trades => {
    let {
      e: eventType,
      E: eventTime,
      s: symbol,
      p: priceStr,
      q: quantity,
      m: maker,
      a: tradeId
    } = trades;
    const price = Number(priceStr);

    if (stopLossOrders[symbol]) {
      purchasedSymbolPriceUpdated(symbol, price);
    }

    const refPrice = referencePrices[symbol];
    if (!refPrice) {
      referencePrices[symbol] = price;
      return;
    }

    if (refPrice > price) {
      referencePrices[symbol] = price;
      console.info(`${symbol} - ${price}, 🔻`);
      return;
    }

    if (price > refPrice) {
      const percentageUp = (price / refPrice - 1) * 100;
      console.info(`${symbol} - ${price}, 🟢 ${percentageUp}%`);

      if (percentageUp >= BUY_TRIGGER_LEVEL) {
        buy(symbol, price);
      }
    }
  });
}

async function buy(symbol, approxPrice) {
  const quantity = getAmountToBuy(symbol, approxPrice);
  console.log('🔥 quantity:', quantity);

  try {
    const resp = await binance.marketBuy(symbol, quantity);
    // Example prod response
    // const resp = {
    //   clientOrderId: 'eS2SKoSfJSUaTMGY2a5aOo',
    //   cummulativeQuoteQty: '11.98687500',
    //   executedQty: '1.25000000',
    //   fills: [
    //     {
    //       commission: '0.00001590',
    //       commissionAsset: 'BNB',
    //       price: '9.58950000',
    //       qty: '1.25000000',
    //       tradeId: 1865645
    //     }
    //   ],
    //   orderId: 59298780,
    //   orderListId: -1,
    //   origQty: '1.25000000',
    //   price: '0.00000000',
    //   side: 'BUY',
    //   status: 'FILLED',
    //   symbol: 'SRMBUSD',
    //   timeInForce: 'GTC',
    //   transactTime: 1619586815786,
    //   type: 'MARKET'
    // };

    await loadBalances();
    setStopLoss(symbol, approxPrice, quantity);
    // testSell(symbol, Number(resp.executedQty));
    debugger;
  } catch (e) {
    const responseError = getResponseError(e);
    console.log('🔥', responseError.code, responseError.message);
    debugger;
  }
}

async function setStopLoss(symbol, approxPrice, quantity) {
  let sellQuantity = quantity;
  if (stopLossOrders[symbol]) {
    sellQuantity = sellQuantity || stopLossOrders[symbol].qty;
    await binance.cancel(symbol, stopLossOrders[symbol].id);
  }

  let type = 'STOP_LOSS_LIMIT';
  // TODO - figure out the best way to set up stop loss levels
  // 3% price down
  let price = roundPrecision(symbol, approxPrice - approxPrice * 0.03);
  // 2.5% price down
  let stopPrice = roundPrecision(symbol, approxPrice - approxPrice * 0.025);
  try {
    const resp = await binance.sell(symbol, quantity, price, { stopPrice: stopPrice, type: type });

    stopLossOrders[symbol] = {
      id: resp.id,
      qty: sellQuantity
    };
  } catch (e) {
    const responseError = getResponseError(e);
    debugger;
  }
}

function purchasedSymbolPriceUpdated(symbol, approxPrice) {
  // TODO:
  // - check if stop loss price should be higher (price growing) + update it
  // - check if price is lower than stop loss price - emergency market sell
  // - check if stop loss still exists - if it triggered correctly just remove it from stopLossOrders
}

async function testSell(symbol, quantity) {
  try {
    const resp = await binance.marketSell(symbol, quantity);
    debugger;
  } catch (e) {
    const responseError = getResponseError(e);
    console.log('🔥', responseError.code, responseError.message);
    debugger;
  }
}

function roundPrecision(symbol, toRound) {
  const numToRound = Number(toRound);
  const stepSize = filters[symbol]?.stepSize;
  return binance.roundStep(numToRound, stepSize);
}

function getAmountToBuy(symbol, approxPrice) {
  const amount = SINGLE_TRANSACTION_USD_AMOUNT / Number(approxPrice);
  return roundPrecision(symbol, amount);
}

async function loadSymbolsInfo() {
  const resp = await binance.exchangeInfo();
  let minimums = {};
  for (let obj of resp.symbols) {
    let filters = { status: obj.status };
    for (let filter of obj.filters) {
      if (filter.filterType == 'MIN_NOTIONAL') {
        filters.minNotional = filter.minNotional;
      } else if (filter.filterType == 'PRICE_FILTER') {
        filters.minPrice = filter.minPrice;
        filters.maxPrice = filter.maxPrice;
        filters.tickSize = filter.tickSize;
      } else if (filter.filterType == 'LOT_SIZE') {
        filters.stepSize = filter.stepSize;
        filters.minQty = filter.minQty;
        filters.maxQty = filter.maxQty;
      }
    }
    //filters.baseAssetPrecision = obj.baseAssetPrecision;
    //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
    filters.orderTypes = obj.orderTypes;
    filters.icebergAllowed = obj.icebergAllowed;
    minimums[obj.symbol] = filters;
  }
  filters = minimums;
}

async function loadBalances() {
  balances = await binance.balance();
}

async function runApp() {
  await binance.useServerTime();
  await loadSymbolsInfo();
  await loadBalances();

  // Test getting prices
  const prices = await binance.prices();
  console.log('🔥 price', prices.SRMBUSD, filters.SRMBUSD);
  // Test purchase
  // buy('SRMBUSD', prices.SRMUSDT);
  // setStopLoss('SRMBUSD', 9.16, 1.26);

  watchPrices();
}

function getResponseError(e) {
  if (e.body) {
    return JSON.parse(e.body);
  }

  return null;
}

runApp();
