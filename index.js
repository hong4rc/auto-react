'use strict';
const requestMyself = require('request-myself');
const express = require('express');
const app = express();
const api = require('./lib/api');
const log = require('./lib/log');
const timer = require('./lib/timer');

const DEFAULT_PORT = 1997;
const DEFAULT_TIME_IDLING = 60000;
const port = process.env.PORT || DEFAULT_PORT;
app.listen(port, log.info('This app is running in port', port));

const option = {
    hostname: process.env.BASE_URL,
    timeout: process.env.TIME_IDLING || DEFAULT_TIME_IDLING
};
app.use(requestMyself(option, (error, res) => {
    if (error) {
        log.error('RequestMyself statusCode:', res.statusCode, error);
    } else {
        log.info('RequestMyself statusCode:', res.statusCode, timer.getCurrentTime());
    }
}));

api().then(func => {
    func.start();
});


