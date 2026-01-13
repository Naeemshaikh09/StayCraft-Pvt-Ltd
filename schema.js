const Joi = require("joi");

const allowedCategories = [
  "Trending",
  "Rooms",
  "Iconic cities",
  "Amazing views",
  "Beachfront",
  "Amazing pools",
  "Cabins",
  "Camping",
  "Lakefront",
  "Arctic",
  "Islands",
  "Castles",
  "Farms",
];

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().trim().min(3).max(120).required(),
    description: Joi.string().trim().allow("").max(2000),
    price: Joi.number().min(0).required(),
    location: Joi.string().trim().required(),
    country: Joi.string().trim().required(),

    // ✅ added
    category: Joi.string().valid(...allowedCategories).default("Trending"),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comments: Joi.string().trim().min(1).max(1000).required(),
  }).required(),
});

module.exports.signupSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

module.exports.loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
});