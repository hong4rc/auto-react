'use strict';
const fetch = require('./fetch');
const log = require('./log');

const GRAPH = 'https://graph.facebook.com';
const FIRST = 0;
const SPACE_INDENT = 4;
const MAX_LENGTH_MSG = 50;
const MAX_REACT = 900;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = 5000;
const MAX_FRIEND_FB = 5000;
const DEFAULT_NEWS = 20;
const newsInOne = process.env.NEWS_IN_FEED || DEFAULT_NEWS;
const HOME_URL = `/me/home?fields=id,story,from,message,reactions.limit(${MAX_REACT})&limit=${newsInOne}`;
const FRIENDS_QUERY = `/me/friends?limit=${MAX_FRIEND_FB}`;

const timeout = delta => new Promise(resolve => {
    setTimeout(() => {
        resolve(delta);
    }, delta);
});
const REACTS = [
    'LOVE', 'LIKE'
];

const getType = () => REACTS[Math.floor(Math.random() * REACTS.length)];

const listBot = [];

class BotReact {
    constructor(token) {
        this._token = token;
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
                if (res.error) {
                    log.error(res.error);
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
                this._friends = res.data.map(user => user.id);
                this._isAlive = true;
            });
    }

    parseData(data) {
        const prepares = [];
        log.verbose(Array.isArray(data));
        for (const news of data) {
            const from = news.from;
            if (this._friends.indexOf(from.id) < FIRST) {
                log.warn(`${from.name} is not ${this._name}'s friend`);
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
                log.info(this._name, 'liked it', news.id);
                continue;
            }
            prepares.push(news.id);
        }
        return prepares;
    }

    reactNews(ids) {
        for (const id of ids) {
            this.promise = this.promise
                .then(() => this.graph(`/${id}/reactions?method=post&type=${getType()}`))
                .then(res => {
                    if (res.error) {
                        return log.error(this._name, res.error.message);
                    }
                    return log.info(id, res);
                })
                .then(() => timeout(TIMEOUT_REACT));
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
}

module.exports = BotReact;
