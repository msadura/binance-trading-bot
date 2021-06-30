const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.BINANCE_KEY,
  APISECRET: process.env.BINANCE_SECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: false
};

const binance = new Binance().options(config);
binance.futuresOrder();

module.exports = binance;
