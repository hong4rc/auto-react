const fetch = require('node-fetch');
const debug = require('debug');
const Lru = require('quick-lru');

const log = debug('manager:');
const GRAPH_VERSION = 3.2;
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const FIRST = 0;
const DF_LENGTH_NAME = 6;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = 5000;
const MAX_FRIEND_FB = 5000;
const MAX_PAGE_LIKED = 5000;
const dtTime = 2000;
const DEFAULT_NEWS = 20;
const ID_FEED_MAX = 35;
const newsInOne = process.env.NEWS_IN_FEED || DEFAULT_NEWS;
const HOME_URL = `/me/home?fields=id,story,from,message,likes&limit=${newsInOne}`;
const FRIENDS_QUERY = `/me/friends?limit=${MAX_FRIEND_FB}`;
const PAGES_QUERY = `/me/likes?fields=name,id&limit=${MAX_PAGE_LIKED}`;
const ERR = {
  ActionBlocked: 368,
};

const timeout = delta => new Promise((resolve) => {
  setTimeout(() => {
    resolve(delta);
  }, delta);
});
const REACTS = [
  { type: 'LOVE', icon: '❤️' },
  { type: 'LIKE', icon: '👍' },
];

const getReact = () => REACTS[Math.floor(Math.random() * REACTS.length)];

const listBot = [];

class BotReact {
  constructor(token) {
    this.token = token;
    this.name = token.substr(-DF_LENGTH_NAME, DF_LENGTH_NAME);
    this.alive = true;
    this.delta = 0;
    this.lru = new Lru({ maxSize: 1000 });
    this.init();
    listBot.push(this);
  }

  static getListBot() {
    return listBot;
  }

  static fetch(url) {
    return fetch(url).then(res => res.json())
      .catch(() => BotReact.fetch(url));
  }

  /**
 *
 * @param query
 * @returns {Promise}
 */
  graph(query) {
    let url = `${GRAPH + query}&access_token=${this.token}`;
    if (url.indexOf('?') < FIRST) {
      url = url.replace('&', '?');
    }
    return BotReact.fetch(url);
  }

  init() {
    this.promise = this.graph(START_QUERY)
      .then((res) => {
        if (res.error) {
          this.alive = false;
          throw res.error;
        }
        if (!res.id) {
          this.alive = false;
          log(`Error: unknown your id : ${res.id}`);
        }
        this.id = res.id;
        this.name = res.name;
        this.log = debug(`bot:${this.name}`);
      })
      .then(() => this.syncWhiteList(), error => log('[%s]: %s', this.name, error.message));
  }

  syncWhiteList() {
    Promise.all([this.updateFriends(), this.updatePageLiked()])
      .then(() => this.updateWhiteList());
  }

  updateWhiteList() {
    // TODO: add option white list
    this.whiteList = {};

    this.friends.map((friend) => {
      this.whiteList[friend.id] = friend.name;
      return true;
    });

    this.pages.map((page) => {
      this.whiteList[page.id] = page.name;
      return true;
    });
  }

  updateFriends() {
    return this.graph(FRIENDS_QUERY)
      .then((res) => {
        if (res.error) {
          return this.log(res.error);
        }
        this.friends = res.data;
        return true;
      });
  }

  updatePageLiked() {
    return this.graph(PAGES_QUERY)
      .then((res) => {
        if (res.error) {
          return this.log(res.error);
        }
        this.pages = res.data;
        return true;
      });
  }

  parseData(data) {
    const prepares = [];
    data.forEach((news) => {
      const { from, id, likes } = news;
      if (!from) {
        this.log('Story %s', news.story);
        return false;
      }
      if (from.id === this.id) {
        return true;
      }

      if (this.lru.has(id)) {
        return false;
      }
      this.lru.set(news.id, true);

      if (!Object.prototype.hasOwnProperty.call(this.whiteList, from.id)) {
        this.log('❌ %s | %s', id.padStart(ID_FEED_MAX, ' '), from.name);
        return false;
      }

      const ids = (likes && likes.data && likes.data.map(react => react.id)) || [];
      if (ids.includes(this.id)) {
        this.log('✔️ %s | %s', news.id.padStart(ID_FEED_MAX, ' '), from.name);
        return false;
      }
      return prepares.push(news);
    });
    return prepares;
  }

  ping() {
    this.delta += dtTime;
    setTimeout(() => {
      if (this.delta > 0) {
        this.delta -= dtTime;
      }
    }, 30000);
  }

  reactNews(newsList) {
    newsList.forEach((news) => {
      const { id, from } = news;
      const react = getReact();
      this.promise = this.promise
        .then(() => this.isAlive())
        .then(() => this.graph(`/${id}/reactions?method=post&type=${react.type}`))
        .then((res) => {
          const err = res.error;
          if (err) {
            switch (err.code) {
              case ERR.ActionBlocked:
                this.alive = false;
                throw new Error(err.message);
              default:
                return this.log('%s %s', id, err.message);
            }
          } else {
            this.ping();
            return this.log('%s %s | %s', react.icon, id.padStart(ID_FEED_MAX, ' '), from.name);
          }
        })
        .then(() => timeout(TIMEOUT_REACT + this.delta))
        .catch(err => err && this.log(err));
    });
  }

  likeHome() {
    this.promise = this.promise.then(() => {
      if (!this.alive) {
        throw this.alive;
      }
      return true;
    }).then(() => this.graph(HOME_URL))
      .then((res) => {
        const prepares = this.parseData(res.data);
        this.reactNews(prepares);
      })
      .catch((reason) => {
        if (this.log) {
          this.log(reason);
        }
      });
    return this.promise.finally(() => {
      if (this.alive) {
        return this.likeHome();
      }
      if (this.log) {
        this.log('stopped');
      }
      return false;
    });
  }

  isAlive() {
    if (this.alive) {
      return Promise.resolve(this.alive);
    }
    return Promise.reject(this.alive);
  }
}

module.exports = BotReact;
