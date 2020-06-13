const axios = require('axios');
const QuickLRU = require('quick-lru');

process.env.DEBUG = '*';
const debug = require('debug');

const Like = require('./db/model/like');

const GRAPH_VERSION = '5.0';
/* eslint-disable no-unused-vars */
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const DF_LENGTH_NAME = 6;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = process.env.TIMEOUT_REACT || 5000;
const TIMEOUT_FETCH = process.env.TIMEOUT_FETCH || 15000;
const MAX_FRIEND_FB = 5000;
const MAX_PAGE_LIKED = 5000;
const MAX_TRY_REQUEST = 3;
const dtTime = 2000;
const ID_FEED_MAX = 35;
const newsInOne = process.env.NEWS_IN_FEED || 20;
const HOME_URL = `/me/home?fields=id,message,reactions,permalink_url,parent_id,created_time&limit=${newsInOne}`;
const maxSize = 8000;
/* eslint-enable no-unused-vars */

const timeout = (time = 0) => new Promise((resolve) => {
  setTimeout(() => resolve(), time);
});

module.exports = class Bot {
  /**
   * Create new bot
   * @param {string} token your fb token
   * @property {boolean} continue available to auto react
   * @property {Promise} chainHome promise loop react home
   * @property {QuickLRU} cached cache liked post
   * @property {string[]} likeStack array to
   */
  constructor(token) {
    this.token = token;
    this.continue = true;
    this.chainHome = undefined;
    this.cached = new QuickLRU({ maxSize });
    this.initPromise = this.graph(START_QUERY).then(({ id, name }) => {
      this.id = id;
      this.name = name;
      this.log = debug(name);
    }).then(() => Like.find({ from: this.id }, ['id_post'], {
      limit: maxSize,
      sort: { time: -1 },
    }).then((posts) => {
      posts.forEach((post) => {
        this.cached.set(post.id_post, true);
      });
      this.log(this.id, 'loaded', posts.length);
    }));
    this.likeStack = [];
    this.timeoutId = 0;
  }

  static fetch(url) {
    return axios(url)
      .then((response) => response.data);
  }

  async graph(query) {
    const url = new URL(GRAPH + query);
    url.searchParams.set('access_token', this.token);
    return Bot.fetch(url.href);
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
    data.forEach(({
      id, parent_id: parentId, reactions,
      permalink_url: permalinkUrl, created_time: createdTime,
    }) => {
      // Ignore the shared port
      if (parentId) {
        this.cached.set(parentId, true);
      }

      // Cached this id;
      if (this.cached.has(id)) {
        return;
      }
      this.cached.set(id, true);

      // Liked this post
      if (reactions && reactions.data.some((post) => post.id === this.id)) {
        this.log('Liked', permalinkUrl, id);
        return;
      }

      // 15h
      if (Date.now() - new Date(createdTime) > 54000000) {
        this.log('Old  ', permalinkUrl);
        return;
      }

      idReact.push({ id, permalinkUrl });
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
      // No more available post
      return;
    }
    if (!this.continue) {
      return;
    }
    const likeLoop = async () => {
      const { id, permalinkUrl } = this.likeStack.shift();
      try {
        await new Like({
          id_post: id,
          url: permalinkUrl,
          from: this.id,
        }).save();
        try {
          await this.graph(`/likes?ids=${id}&method=post`);
          this.log('Like ', permalinkUrl);
        } catch (error) {
          this.log('error', permalinkUrl);
        }
      } catch (error) {
        this.log('duplicate', permalinkUrl);
      }

      if (this.likeStack.length === 0) {
        // No more available post
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
