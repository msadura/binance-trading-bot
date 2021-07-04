const { loadSymbolPrice } = require('../prices');

const tradesReport = {
  all: 0,
  w: 0,
  l: 0,
  i: 0,
  pnl: 0
};

function addTradeToReport(config, executedPrice, type) {
  const { symbol, openPrice, side } = config;
  tradesReport.all++;

  const pnl = getPNL(config, executedPrice);

  if (pnl) {
    tradesReport.pnl = Number((tradesReport.pnl + pnl).toFixed(3));
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
        }, sell: ${executedPrice}, pnl: ${pnl || '-'}`
      );
      break;
    }
    case 'loss': {
      tradesReport.l++;

      console.log(
        '💥 🔴',
        `${symbol} SL HIT :( ${tradeType[side]} buy: ${
          openPrice || '-'
        }, sell: ${executedPrice}, pnl: ${pnl || '-'}`
      );
      break;
    }
    case 'manual': {
      tradesReport.i++;

      console.log(
        '💥 🟡',
        `${symbol} MANUAL SELL - buy: ${openPrice || '-'}, sell: ${executedPrice}, pnl: ${
          pnl || '-'
        }`
      );
      break;
    }
  }

  console.log('🔥 Summary:', tradesReport);

  // send stats to db, send email etc
}

async function openPositionsReport(openPositions = {}) {
  const positionsArr = Object.values(openPositions);
  const report = {};
  let totalPnl = 0;

  for (const positionConfig of positionsArr) {
    if (positionConfig) {
      const price = await loadSymbolPrice(positionConfig.symbol);
      const pnl = getPNL(positionConfig, price);
      report[positionConfig.symbol] = pnl;
      if (pnl) {
        totalPnl = totalPnl + pnl;
      }
    }
  }

  console.log(`🔥 Open pos. ${positionsArr.length} pnl: ${totalPnl}$`);
  console.log(`🔥 ${JSON.stringify(report)}`);
}

function getPNL(config, price) {
  const { openPrice, side } = config;

  let priceDiff = null;
  if (side === 'BUY') {
    priceDiff = openPrice ? Number(price) - openPrice : null;
  }

  if (side === 'SELL') {
    priceDiff = openPrice ? openPrice - Number(price) : null;
  }

  if (priceDiff) {
    return Number((priceDiff * config.quantity).toFixed(3));
  }
}

module.exports = {
  addTradeToReport,
  tradesReport,
  openPositionsReport
};
