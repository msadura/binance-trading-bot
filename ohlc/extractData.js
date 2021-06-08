function extractDataByProperty(ohlcArray, propertyName) {
  if (!propertyName || !ohlcArray) {
    return null;
  }

  return ohlcArray.map(c => c[propertyName]);
}

module.exports = extractDataByProperty;
