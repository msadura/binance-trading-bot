const tradesReport = {
  count: 0,
  wins: 0,
  loses: 0,
  balanceDiff: 0
};

function addTradeToReport(config, executedPrice, isWin) {
  const { symbol, refPrice } = config;
  tradesReport.count++;
  isWin ? tradesReport.wins++ : tradesReport.loses++;

  const priceDiff = refPrice ? Number(executedPrice) - refPrice : null;
  const balanceDiff = priceDiff ? priceDiff * config.quantity : null;

  if (balanceDiff) {
    tradesReport.balanceDiff = tradesReport.balanceDiff + balanceDiff;
  }

  if (isWin) {
    console.log(
      '💰 🟢',
      `${symbol} TP HIT! buy: ${refPrice || '-'}, sell: ${executedPrice}, diff: ${
        balanceDiff || '-'
      }`
    );
    console.log('🔥 Summary:', tradesReport);
  } else {
    console.log(
      '💥 🔴',
      `${symbol} SL HIT :( buy: ${refPrice || '-'}, sell: ${executedPrice}, diff: ${
        balanceDiff || '-'
      }`
    );

    console.log('🔥 Summary:', tradesReport);
  }

  // send stats to db, send email etc
}

module.exports = {
  addTradeToReport,
  tradesReport
};
