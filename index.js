require('dotenv').config();
const debug = require('debug');

const BotReact = require('./lib/bot');

const TOKENS = JSON.parse(process.env.TOKENS) || '<Your list token here>';

TOKENS.forEach((token) => {
  const myBot = new BotReact(token);
  myBot.likeHome();
});

process.on('SIGINT', () => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  const usedRound = Math.round(used * 100) / 100;
  debug('memoryUsage')('%d MB', usedRound);
  process.exit();
});
