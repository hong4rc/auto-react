'use strict';
const fetch = require('./fetch');
const log = require('kiat-log');

const GRAPH_VERSION = 3.2;
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const FIRST = 0;
const SPACE_INDENT = 4;
const DF_LENGTH_NAME = 6;
const MAX_LENGTH_MSG = 50;
const MAX_REACT = 900;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = 5000;
const MAX_FRIEND_FB = 5000;
const DEFAULT_NEWS = 20;
const newsInOne = process.env.NEWS_IN_FEED || DEFAULT_NEWS;
const HOME_URL = `/me/home?fields=id,story,from,message,reactions.limit(${MAX_REACT})&limit=${newsInOne}`;
const FRIENDS_QUERY = `/me/friends?limit=${MAX_FRIEND_FB}`;
const ERR = {
    ActionBlocked: 368
};

const timeout = delta => new Promise(resolve => {
    setTimeout(() => {
        resolve(delta);
    }, delta);
});
const REACTS = [
    {type: 'LOVE', icon: '♥'},
    {type: 'LIKE', icon: '👍'},
];

const getReact = () => REACTS[Math.floor(Math.random() * REACTS.length)];

const listBot = [];

class BotReact {
    constructor(token) {
        this._token = token;
        this._name = token.substr(-DF_LENGTH_NAME, DF_LENGTH_NAME);
        this._isAlive = true;
        this.init();
        listBot.push(this);
    }

    static getListBot() {
        return listBot;
    }

    /** *
     *
     * @param query
     * @returns {Promise}
     */
    graph(query) {
        let url = `${GRAPH + query}&access_token=${this._token}`;
        if (url.indexOf('?') < FIRST) {
            url = url.replace('&', '?');
        }
        return fetch(url);
    }

    init() {
        this.promise = this.graph(START_QUERY)
            .then(res => {
                const err = res.error;
                if (err) {
                    switch (err.type) {
                        case 'OAuthException':
                            this._isAlive = false;
                            throw new Error(err.message);
                        default:
                            log.error(err.message);
                    }
                } else if (!res.id) {
                    log.error(`Unknown your id : ${res.id}`);
                }
                this._id = res.id;
                this._name = res.name;
            })
            .then(() => this.graph(FRIENDS_QUERY))
            .then(res => {
                if (res.error) {
                    return log.error(res.error);
                }
                this._friends = {};
                res.data.map(friend => {
                    this._friends[friend.id] = friend.name;
                });
                this._isAlive = true;
            });
    }

    parseData(data) {
        const prepares = [];
        log.verbose(Array.isArray(data));
        for (const news of data) {
            const from = news.from;
            if (!from) {
                log.warn(news.story);
                continue;
            }
            if (!this._friends.hasOwnProperty(from.id)) {
                log.warn(`${this._name} ✖ ${from.name}`);
                continue;
            }
            const reactions = news.reactions || {paging: '', data: []};
            if (reactions.paging.next) {
                log.info(news.id, 'have many like, you should don\'t like it.');
                continue;
            }

            log.verbose(JSON.stringify({
                id: news.id,
                story: news.story,
                msg: news.message && news.message.slice(FIRST, MAX_LENGTH_MSG)
            }, null, SPACE_INDENT));
            const ids = reactions.data.map(react => react.id);
            if (ids.indexOf(this._id) >= FIRST) {
                log.info(`${this._name} ✔ ${news.id}`);
                continue;
            }
            prepares.push(news.id);
        }
        return prepares;
    }

    reactNews(ids) {
        for (const id of ids) {
            const react = getReact();
            this.promise = this.promise
                .then(() => this.isAlive())
                .then(() => this.graph(`/${id}/reactions?method=post&type=${react.type}`))
                .then(res => {
                    const err = res.error;
                    if (err) {
                        switch (err.code) {
                            case ERR.ActionBlocked:
                                this._isAlive = false;
                                throw new Error(err.message);
                            default:
                                log.error(this._name, id, err.message);
                        }
                    } else {
                        return log.info(this._name, react.icon, id);
                    }
                })
                .then(() => timeout(TIMEOUT_REACT))
                .catch(err => err && log.error(err));
        }
    }

    likeHome() {
        if (!this._isAlive) {
            return log.warn(this._name, 'stopped');
        }
        this.promise = this.promise.then(() => this.graph(HOME_URL))
            .then(res => {
                const prepares = this.parseData(res.data);
                log.verbose(prepares);
                this.reactNews(prepares);
            })
            .catch(reason => {
                log.error(this._name, reason);
            });
        this.promise.finally(() => this.promise
            .then(() => this.likeHome()));
    }

    isAlive() {
        if (this._isAlive) {
            return Promise.resolve(this._isAlive);
        }
        return Promise.reject(this._isAlive);
    }
}

module.exports = BotReact;
