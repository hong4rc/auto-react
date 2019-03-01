const fetch = require('node-fetch');
const debug = require('debug');

const GRAPH_VERSION = 3.2;
const GRAPH = `https://graph.facebook.com/v${GRAPH_VERSION}`;
const FIRST = 0;
const DF_LENGTH_NAME = 6;
const START_QUERY = '/me?fields=id,name';
const TIMEOUT_REACT = 5000;
const MAX_FRIEND_FB = 5000;
const MAX_PAGE_LIKED = 5000;
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
    this.log = debug(this.name);
    this.alive = true;
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
    let url = `${GRAPH + query}&access_token=${this.token}`;
    if (url.indexOf('?') < FIRST) {
      url = url.replace('&', '?');
    }
    return fetch(url).then(res => res.json());
  }

  init() {
    this.promise = this.graph(START_QUERY)
      .then((res) => {
        const err = res.error;
        if (err) {
          switch (err.type) {
            case 'OAuthException':
              this.alive = false;
              throw new Error(err.message);
            default:
              this.log(err.message);
          }
        } else if (!res.id) {
          this.log(`Error: unknown your id : ${res.id}`);
        }
        this.id = res.id;
        this.name = res.name;
        this.alive = true;
      })
      .then(() => this.syncWhiteList());
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
      const { from } = news;
      if (!from) {
        this.log('Story %s', news.story);
        return false;
      }
      if (from.id === this.id) {
        return true;
      }
      if (!Object.prototype.hasOwnProperty.call(this.whiteList, from.id)) {
        this.log('%s ❌ %s | %s', this.name, news.id.padStart(ID_FEED_MAX, ' '), from.name);
        return false;
      }
      const { likes } = news;

      const ids = (likes && likes.data && likes.data.map(react => react.id)) || [];
      if (ids.indexOf(this.id) >= FIRST) {
        this.log('%s ✔️ %s | %s', this.name, news.id.padStart(ID_FEED_MAX, ' '), from.name);
        return false;
      }
      return prepares.push(news.id);
    });
    return prepares;
  }

  reactNews(ids) {
    ids.forEach((id) => {
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
                return this.log('%s %s', this.name, id, err.message);
            }
          } else {
            return this.log('%s %s %s', this.name, react.icon, id);
          }
        })
        .then(() => timeout(TIMEOUT_REACT))
        .catch(err => err && this.log(err));
    });
  }

  likeHome() {
    if (!this.alive) {
      return this.log('%s %s', this.name, 'stopped');
    }
    this.promise = this.promise.then(() => this.graph(HOME_URL))
      .then((res) => {
        const prepares = this.parseData(res.data);
        this.reactNews(prepares);
      })
      .catch((reason) => {
        this.log('%s %s', this.name, reason);
      });
    return this.promise.finally(() => this.promise
      .then(() => this.likeHome()));
  }

  isAlive() {
    if (this.alive) {
      return Promise.resolve(this.alive);
    }
    return Promise.reject(this.alive);
  }
}

module.exports = BotReact;
