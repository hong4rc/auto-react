require('dotenv').config();

const mongoose = require('mongoose');

const Bot = require('./bot');

const token = process.env.TOKEN || 'your token here';
let tried = 0;

const connect = () => {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useCreateIndex: true,
  });
  return mongoose.connection;
};

const reconnect = () => {
  if (tried >= 5) {
    return false;
  }
  tried += 1;
  return connect();
};

connect()
  .on('error', console.log)
  .on('disconnected', reconnect)
  .once('open', () => {
    console.log('db connected!!');
    const me = new Bot(token);

    me.likeHome();
  });
