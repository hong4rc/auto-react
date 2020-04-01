const axios = require('axios');
const QuickLRU = require('quick-lru');

process.env.DEBUG = '*';
const debug = require('debug');


const GRAPH_VERSION = '5.0';
/* eslint-disable no-unused-vars */
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const DF_LENGTH_NAME = 6;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = 5000;
const TIMEOUT_FETCH = 15000;
const MAX_FRIEND_FB = 5000;
const MAX_PAGE_LIKED = 5000;
const MAX_TRY_REQUEST = 3;
const dtTime = 2000;
const ID_FEED_MAX = 35;
const newsInOne = process.env.NEWS_IN_FEED || 20;
const HOME_URL = `/me/home?fields=id,story,from,message,reactions,link,permalink_url,parent_id&limit=${newsInOne}`;
/* eslint-enable no-unused-vars */

const timeout = (time = 0) => new Promise((resolve) => {
  setTimeout(() => resolve(), time);
});

module.exports = class Bot {
  /**
   * Create new bot
   * @param {string} token your fb token
   * @property {boolean} continue avaible to auto react
   * @property {Promise} chainHome promise loop react home
   * @property {QuickLRU} cached cache liked post
   * @property {string[]} likeStack array to
   */
  constructor(token) {
    this.token = token;
    this.continue = true;
    this.chainHome = null;
    this.initPromise = this.graph(START_QUERY).then(({ id, name }) => {
      this.id = id;
      this.name = name;
      this.log = debug(name);
    });
    this.cached = new QuickLRU({ maxSize: 800 });
    this.likeStack = [];
    this.timeoutId = 0;
  }


  static fetch(url) {
    return axios(url)
      .then((response) => response.data);
  }

  graph(query) {
    let tried = 0;
    const url = new URL(GRAPH + query);
    url.searchParams.set('access_token', this.token);
    while (tried < MAX_TRY_REQUEST) {
      tried += 1;
      try {
        return Bot.fetch(url.href);
      // eslint-disable-next-line no-empty
      } catch (_) {}
    }
    throw new Error('Request > MAX_TRY_REQUEST time:', query);
  }

  likeHome() {
    if (!this.continue) {
      return false;
    }
    if (this.chainHome) {
      this.log('Just use once like home');
      return this.chainHome;
    }
    const loop = () => this.initPromise
      .then(() => this.graph(HOME_URL))
      .then(({ data }) => {
        this.handleData(data);
        return timeout(TIMEOUT_FETCH);
      })
      .then(loop);
    this.chainHome = loop();
    return this.chainHome;
  }

  handleData(data) {
    if (!Array.isArray(data)) {
      this.log('This should be array');
      return;
    }

    const idReact = [];

    // console.log(data.length);
    data.forEach(({ id, parent_id: parentId, reactions }) => {
      // Ignore the shared port
      if (parentId) {
        this.cached.set(parentId, true);
      }

      // Cached this id;
      if (this.cached.has(id)) {
        return;
      }

      // Liked this post
      if (reactions && reactions.data.some((post) => post.id === this.id)) {
        this.cached.set(id, true);
        this.log('Liked', id);
        return;
      }

      this.cached.set(id, true);
      idReact.push(id);
    });
    if (idReact.length > 0) {
      this.likeStack.push(...idReact);
      this.triggerLike();
    }
  }

  triggerLike() {
    if (this.timeoutId) {
      // Another trigger in process
      return;
    }
    if (this.likeStack.length === 0) {
      // No more avaiable post
      return;
    }
    if (!this.continue) {
      return;
    }
    const likeLoop = () => {
      const id = this.likeStack.shift();
      this.graph(`/likes?ids=${id}&method=post`)
        .then(() => {
          this.log('Liked', id);
        }, () => {
          this.log('error', id);
        });

      if (this.likeStack.length === 0) {
        // No more avaiable post
        this.timeoutId = 0;
        return;
      }
      this.timeoutId = setTimeout(() => {
        likeLoop();
      }, TIMEOUT_REACT);
    };

    likeLoop();
  }
};
