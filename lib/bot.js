'use strict';
const fetch = require('node-fetch');
const debug = require('debug');

const GRAPH_VERSION = 3.2;
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const FIRST = 0;
const DF_LENGTH_NAME = 6;
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
        this.log = debug(this._name);
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
        return fetch(url).then(res => res.json());
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
                            this.log(err.message);
                    }
                } else if (!res.id) {
                    this.log(`Error: unknown your id : ${res.id}`);
                }
                this._id = res.id;
                this._name = res.name;
            })
            .then(() => this.graph(FRIENDS_QUERY))
            .then(res => {
                if (res.error) {
                    return this.log(res.error);
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
        for (const news of data) {
            const from = news.from;
            if (!from) {
                this.log('Story %s', news.story);
                continue;
            }
            if (!this._friends.hasOwnProperty(from.id)) {
                this.log('%s ✖ %s', this._name, from.name);
                continue;
            }
            const reactions = news.reactions || {paging: '', data: []};
            if (reactions.paging.next) {
                this.log('%s have many like, you should don\'t like it.', news.id);
                continue;
            }

            const ids = reactions.data.map(react => react.id);
            if (ids.indexOf(this._id) >= FIRST) {
                this.log('%s ✔ %s', this._name, news.id);
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
                                this.log('%s %s', this._name, id, err.message);
                        }
                    } else {
                        return this.log('%s %s %s', this._name, react.icon, id);
                    }
                })
                .then(() => timeout(TIMEOUT_REACT))
                .catch(err => err && this.log(err));
        }
    }

    likeHome() {
        if (!this._isAlive) {
            return this.log('%s %s', this._name, 'stopped');
        }
        this.promise = this.promise.then(() => this.graph(HOME_URL))
            .then(res => {
                const prepares = this.parseData(res.data);
                this.reactNews(prepares);
            })
            .catch(reason => {
                this.log('%s %s', this._name, reason);
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
