const tradesReport = {
  count: 0,
  wins: 0,
  loses: 0,
  idle: 0,
  balanceDiff: 0
};

function addTradeToReport(config, executedPrice, type) {
  const { symbol, refPrice } = config;
  tradesReport.count++;

  const priceDiff = refPrice ? Number(executedPrice) - refPrice : null;
  const balanceDiff = priceDiff ? priceDiff * config.quantity : null;

  if (balanceDiff) {
    tradesReport.balanceDiff = tradesReport.balanceDiff + balanceDiff;
  }

  switch (type) {
    case 'win': {
      tradesReport.wins++;

      console.log(
        '💰 🟢',
        `${symbol} TP HIT! buy: ${refPrice || '-'}, sell: ${executedPrice}, diff: ${
          balanceDiff || '-'
        }`
      );
      break;
    }
    case 'loss': {
      tradesReport.loses++;

      console.log(
        '💥 🔴',
        `${symbol} SL HIT :( buy: ${refPrice || '-'}, sell: ${executedPrice}, diff: ${
          balanceDiff || '-'
        }`
      );
      break;
    }
    case 'idle': {
      tradesReport.idle++;

      console.log(
        '💥 🟡',
        `${symbol} IDLE SELL - buy: ${refPrice || '-'}, sell: ${executedPrice}, diff: ${
          balanceDiff || '-'
        }`
      );
      break;
    }
  }

  console.log('🔥 Summary:', tradesReport);

  // send stats to db, send email etc
}

module.exports = {
  addTradeToReport,
  tradesReport
};
