let cacheSize = 15;
let ohlc = {};

function addOhlcPair(pair, data) {
  if (!ohlc[pair]) {
    ohlc[pair] = [];
  }

  if (ohlc[pair].length === cacheSize) {
    ohlc[pair].shift();
  }

  if (Array.isArray(data)) {
    ohlc[pair] = data;
  } else {
    ohlc[pair].push(data);
  }

  return ohlc[pair];
}

function getohlc(pair) {
  return ohlc[pair] || [];
}

function setOhlcData(data) {
  if (data) {
    ohlc = data;
  }

  return data;
}

function setCacheSize(size) {
  if (size) {
    cacheSize = size;
  }
}

module.exports = { getohlc, addOhlcPair, setOhlcData, setCacheSize };
