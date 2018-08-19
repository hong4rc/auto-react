'use strict';
const request = require('request');

/**
 * @return Promise<any>
 */
const fetch = option => new Promise((resolve, reject) => {
    request(option, (error, res, body) => {
        if (error) {
            reject(new Error('Fail !!!'));
        }
        try {
            resolve(JSON.parse(body));
        } catch (e) {
            resolve(body);
        }
    });
});

module.exports = fetch;
