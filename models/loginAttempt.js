const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const loginAttemptSchema = new Schema({
  usernameLower: { type: String, required: true, index: true },
  ip: { type: String, required: true, index: true },

  count: { type: Number, default: 0 },
  lastAttempt: { type: Date, default: Date.now },
  lockedUntil: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

// auto-delete old records after 1 day
loginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);