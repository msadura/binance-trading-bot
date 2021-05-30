const Binance = require('node-binance-api');

const config = {
  APIKEY: process.env.APIKEY,
  APISECRET: process.env.APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
  // Change to tru for fake transactions
  test: false
};

const binance = new Binance().options(config);

module.exports = binance;
