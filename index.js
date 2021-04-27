require('dotenv').config();
const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
};

if (process.env.USE_TESTNET) {
  config.urls = {
    base: 'https://testnet.binance.vision/api/',
    combineStream: 'wss://testnet.binance.vision/stream?streams=',
    stream: 'wss://testnet.binance.vision/ws/'
  };
}

const binance = new Binance().options(config);
// list of all symbols to watch
const watchTickers = ['MATICUSDT'];
const referencePrices = {};

function watchPrice() {
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
    }
  });
}

function buy(symbol) {
  const quantity = 1;
  binance.marketBuy(symbol, quantity, (error, response) => {
    if (error) {
      console.log('🔥', error);
      return;
    }
    console.info('Market Buy response', response);
    console.info('order id: ' + response.orderId);
    // Now you can limit sell with a stop loss, etc.
  });
}

async function runApp() {
  await binance.useServerTime();

  // Test getting prices
  // let ticker = await binance.prices();
  // console.info(`Price of BNB: ${ticker.BNBUSDT}`);

  // Test get account balance
  binance.balance((error, balances) => {
    if (error) return console.error(error.message);
    console.info('balances()', balances);
    console.info('BNB balance: ', balances.BNB.available);
  });

  // placeOrder('ETHUSDT')

  // watchPrice();
}

runApp();
