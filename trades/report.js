const tradesReport = {
  all: 0,
  w: 0,
  l: 0,
  i: 0,
  diff: 0
};

function addTradeToReport(config, executedPrice, type) {
  const { symbol, openPrice, side } = config;
  tradesReport.all++;

  let priceDiff = null;
  if (side === 'BUY') {
    priceDiff = openPrice ? Number(executedPrice) - openPrice : null;
  }

  if (side === 'SELL') {
    priceDiff = openPrice ? openPrice - Number(executedPrice) : null;
  }
  let balanceDiff = priceDiff ? priceDiff * config.quantity : null;

  if (balanceDiff) {
    balanceDiff = Number(balanceDiff.toFixed(2));
    tradesReport.diff = tradesReport.diff + balanceDiff;
  }

  const tradeType = {
    SELL: 'SHORT',
    BUY: 'LONG'
  };

  switch (type) {
    case 'win': {
      tradesReport.w++;

      console.log(
        '💰 🟢',
        `${symbol} TP HIT! ${tradeType[side]} buy: ${
          openPrice || '-'
        }, sell: ${executedPrice}, diff: ${balanceDiff || '-'}`
      );
      break;
    }
    case 'loss': {
      tradesReport.l++;

      console.log(
        '💥 🔴',
        `${symbol} SL HIT :( ${tradeType[side]} buy: ${
          openPrice || '-'
        }, sell: ${executedPrice}, diff: ${balanceDiff || '-'}`
      );
      break;
    }
    case 'manual': {
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
