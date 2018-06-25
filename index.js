'use strict';
const express = require('express');
const app = express();
const api = require('./lib/api');
const log = require('./lib/log');
const timer = require('./lib/timer');

const DEFAULT_PORT = 1997;
const DEFAULT_IP = '127.0.0.1';

const port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || DEFAULT_PORT;
const ip = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || DEFAULT_IP;
app.listen(port, ip, log.info('This app is running in port', port));
app.get('/', (req, res)=>{
    res.send('Running!!!');
});

api().then(func => {
    func.start();
});
