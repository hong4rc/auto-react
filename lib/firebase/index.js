'use strict';
const admin = require('firebase-admin');

let serviceAccount = process.env.FIREBASE_KEY && JSON.parse(process.env.FIREBASE_KEY);
if (!serviceAccount) {
    serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const database = admin.database();
const friendsRef = database.ref('friends');
const feedsRef = database.ref('feeds');

const pushFriend = friend => {
    friendsRef.child(friend.id).set(friend.name);
};

const log = (id, react) => {
    feedsRef.push().set({id, type: react.type});
};

module.exports = {
    pushFriend,
    log
};
