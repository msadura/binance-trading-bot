const tradesReport = {
  all: 0,
  w: 0,
  l: 0,
  i: 0,
  diff: 0
};

function addTradeToReport(config, executedPrice, type) {
  const { symbol, openPrice } = config;
  tradesReport.all++;

  const priceDiff = openPrice ? Number(executedPrice) - openPrice : null;
  let balanceDiff = priceDiff ? priceDiff * config.quantity : null;

  if (balanceDiff) {
    balanceDiff = Number(balanceDiff.toFixed(2));
    tradesReport.diff = tradesReport.diff + balanceDiff;
  }

  switch (type) {
    case 'win': {
      tradesReport.w++;

      console.log(
        '💰 🟢',
        `${symbol} TP HIT! buy: ${openPrice || '-'}, sell: ${executedPrice}, diff: ${
          balanceDiff || '-'
        }`
      );
      break;
    }
    case 'loss': {
      tradesReport.l++;

      console.log(
        '💥 🔴',
        `${symbol} SL HIT :( buy: ${openPrice || '-'}, sell: ${executedPrice}, diff: ${
          balanceDiff || '-'
        }`
      );
      break;
    }
    case 'idle': {
      tradesReport.i++;

      console.log(
        '💥 🟡',
        `${symbol} MANUAL SELL - buy: ${openPrice || '-'}, sell: ${executedPrice}, diff: ${
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
