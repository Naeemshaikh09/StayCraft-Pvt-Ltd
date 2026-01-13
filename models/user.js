const mongoose = require("mongoose");
const passportLocalMongooseModule = require("passport-local-mongoose");

const passportLocalMongoose =
  passportLocalMongooseModule.default || passportLocalMongooseModule;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  savedListings: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",
  },
],
  resetPasswordTokenHash: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  isEmailVerified: { type: Boolean, default: false },
  verifyEmailTokenHash: { type: String, default: null },
  verifyEmailExpires: { type: Date, default: null },
});

// helpful for mongoose index creation


userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);