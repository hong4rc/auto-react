'use strict';
const request = require('request');

/**
 * @return Promise<any>
 */
const fetch = option => new Promise((resolve, reject) => {
    request(option, (error, res) => {
        if (error) {
            reject(new Error('Fail !!!'));
        }
        try {
            resolve(JSON.parse(res.body));
        } catch (e) {
            resolve(res.body);
        }
    });
});

module.exports = fetch;
