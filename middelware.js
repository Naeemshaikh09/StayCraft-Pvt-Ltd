const mongoose = require("mongoose");
const Listing = require("./models/listing");
const Review = require("./models/review");
const { listingSchema, reviewSchema, signupSchema, loginSchema } = require("./schema");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in");
    return res.redirect("/login");
  }
  next();
};

module.exports.savedRedirectUrl = (req, res, next) => {
  const url = req.session.redirectUrl;
  if (url && typeof url === "string" && url.startsWith("/")) {
    res.locals.redirectUrl = url;
  }
  delete req.session.redirectUrl;
  next();
};

module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }
  if (!listing.owner || !listing.owner.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review) {
    req.flash("error", "Review not found");
    return res.redirect(`/listings/${id}`);
  }
  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You are not the author of this review");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateObjectId = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.isValidObjectId(value)) {
    req.flash("error", "Invalid link.");
    return res.redirect("/listings");
  }
  next();
};

// ✅ allowUnknown true because req.body includes _csrf
module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    req.flash("error", error.details.map((d) => d.message).join(", "));
    return res.redirect("back");
  }
  next();
};

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    req.flash("error", error.details.map((d) => d.message).join(", "));
    return res.redirect("back");
  }
  next();
};

module.exports.validateSignup = (req, res, next) => {
  const { error } = signupSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    req.flash("error", error.details.map((d) => d.message).join(", "));
    return res.redirect("/signup");
  }
  next();
};

module.exports.validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    req.flash("error", "Username and password are required.");
    return res.redirect("/login");
  }
  next();
};
module.exports.isVerified = (req, res, next) => {
  if (!req.user || !req.user.isEmailVerified) {
    req.flash("error", "Please verify your email to continue.");
    return res.redirect("/verify-email/resend");
  }
  next();
};