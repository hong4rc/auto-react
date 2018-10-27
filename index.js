'use strict';

const BotReact = require('./lib/bot');
const TOKENS = JSON.parse(process.env.TOKENS) || '<Your list token here>';

for (const token of TOKENS) {
    const myBot = new BotReact(token);
    myBot.likeHome();
}
