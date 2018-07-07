'use strict';

const api = require('./lib/api');

api().then(func => {
    func.start();
});
