const Bot = require('./bot');

const token = process.env.TOKEN || 'your token here';

const me = new Bot(token);

me.likeHome();
