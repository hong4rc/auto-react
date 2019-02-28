require('dotenv').config();

const BotReact = require('./lib/bot');

const TOKENS = JSON.parse(process.env.TOKENS) || '<Your list token here>';

TOKENS.forEach((token) => {
  const myBot = new BotReact(token);
  myBot.likeHome();
});
