'use strict';

const log = require('./log');

const TOKEN = process.env.TOKEN || '<Your token here>';
const GRAPH_VERSION = 'v3.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FIRST = 0;
const MAX_REACT = 900;
const LIST_REACT = [];
let listFriend;
const REACTS = [
    'LOVE', 'LIKE'
];

const newsInOne = 20;
const SPACE_INDENT = 4;
const MAX_LENGTH_MSG = 50;
const MAX_FRIEND_FB = 5000;
const TIMEOUT_REACT = 10000;
const HOME_URL = `/me/home?fields=id,story,from,message,reactions.limit(${MAX_REACT})&limit=${newsInOne}`;
const START_QUERY = '/me?fields=id';
const FRIENDS_QUERY = `/me/friends?limit=${MAX_FRIEND_FB}`;
let myId;
let isStarted = false;
let isReacting = false;

const fetch = require('./fetch');

/**
 *
 * @param query {String}
 */
const graph = query => {
    let url = `${GRAPH + query}&access_token=${TOKEN}`;
    if (url.indexOf('?') < FIRST) {
        url = url.replace('&', '?');
    }
    return fetch(url);
};
const getType = () => REACTS[Math.floor(Math.random() * REACTS.length)];
const reactNews = id => graph(`/${id}/reactions?method=post&type=${getType()}`)
    .then(res => {
        log.info(id, res);
    });
const processReact = () => {
    if (!LIST_REACT.length) {
        isReacting = false;
        likeHome();
        return;
    }
    const id = LIST_REACT.shift();
    reactNews(id)
        .then(() => {
            setTimeout(processReact, TIMEOUT_REACT);
        });
};
const addNews = id => {
    LIST_REACT.push(id);
    if (!isReacting) {
        processReact();
        isReacting = true;
    }
};

const likeHome = () => {
    graph(HOME_URL)
        .then(res => {
            const data = res.data;
            for (const news of data) {
                const from = news.from;
                if (listFriend.indexOf(from.id) < FIRST) {
                    log.warn(from.name, 'is not your friend');
                    continue;
                }
                const reactions = news.reactions || {paging: '', data: []};
                if (reactions.paging.next) {
                    log.info(news.id, 'have many like, you should don\'t like it.');
                    continue;
                }

                log.info(JSON.stringify({
                    id: news.id,
                    story: news.story,
                    msg: news.message && news.message.slice(FIRST, MAX_LENGTH_MSG)
                }, null, SPACE_INDENT));
                const ids = reactions.data.map(react => react.id);
                if (ids.indexOf(myId) >= FIRST) {
                    log.info('You liked it', news.id);
                    continue;
                }
                addNews(news.id);
            }
            if (!isReacting) {
                likeHome();
            }
        })
        .catch(reason => {
            log.error(reason);
            likeHome();
        });
};
const start = () => {
    if (isStarted) {
        return log.error('This app is running.');
    }
    isStarted = !isStarted;
    likeHome();
};
const func = {
    start
};
const api = () => {
    log.info('------------------------Init------------------------');
    return graph(START_QUERY)
        .then(res => {
            if (res.error) {
                throw new Error(res.error);
            } else if (!res.id) {
                throw new Error(`Unknown your id : ${res.id}`);
            }
            myId = res.id;
        })
        .then(() => graph(FRIENDS_QUERY)
            .then(res => {
                if (res.error) {
                    throw new Error(res.error);
                }
                listFriend = res.data.map(user => user.id);
                return func;
            }));
};

module.exports = api;
