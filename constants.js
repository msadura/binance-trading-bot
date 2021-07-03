const SINGLE_TRADE_USD_AMOUNT = Number(process.env.SINGLE_TRADE_USD_AMOUNT) || 51; //$
const MAX_OPEN_TRADES = Number(process.env.MAX_OPEN_TRADES) || null;
const VIRTUAL_TRADES = !!Number(process.env.VIRTUAL_TRADES) || false;
const BLOCKED_TRADE_COINS = [
  'BNBUSDT',
  'EURUSDT',
  'USDCUSDT',
  'GBPUSDT',
  'BUSDUSDT',
  'TRUUSDT',
  'TUSDUSDT',
  'PAXUSDT'
];
const MANUAL_WATCH_PAIRS = [];

console.log(`SINGLE_TRADE_USD_AMOUNT: ${SINGLE_TRADE_USD_AMOUNT}$`);
console.log(`MAX_OPEN_TRADES: ${MAX_OPEN_TRADES}`);
console.log(`VIRTUAL_TRADES: ${VIRTUAL_TRADES}`);

module.exports = {
  BLOCKED_TRADE_COINS,
  SINGLE_TRADE_USD_AMOUNT,
  MANUAL_WATCH_PAIRS,
  MAX_OPEN_TRADES,
  VIRTUAL_TRADES
};
