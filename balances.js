const binance = require('./binanceApi');

let balances;

async function loadBalances() {
  balances = await binance.balance();
}

async function getBalance(symbol) {
  const coinSymbol = symbol.replace('USDT', '');
  await loadBalances();
  const balance = balances[coinSymbol];
  console.log('ℹ️ ', `${coinSymbol} - BALANCE`, balance);
  return balances[coinSymbol];
}

function getUSDTBalance() {
  if (!balances) {
    throw 'Balances not laoded';
  }

  return balances.USDT;
}

function hasFundsToBuy(buyAmount) {
  const hasFunds = Number(getUSDTBalance().available) >= buyAmount;
  return hasFunds;
}

module.exports = { loadBalances, getBalance, getUSDTBalance, hasFundsToBuy };
