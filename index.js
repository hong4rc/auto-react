'use strict';

const BotReact = require('./lib/bot');
const TOKEN = process.env.TOKEN || '<Your token here>';

const myBot = new BotReact(TOKEN);
myBot.likeHome();
