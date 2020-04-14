const { Schema, model } = require('mongoose');

module.exports = model('React', new Schema({
  id_post: {
    type: String,
    required: true,
    unique: true,
  },
  url: String,
  from: {
    type: String,
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
  },
}));
