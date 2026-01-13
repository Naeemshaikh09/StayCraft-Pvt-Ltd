const express = require("express");
const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapasync.js");
const { isLoggedIn, isVerified, isReviewAuthor, validateReview } = require("../middelware.js");
const reviewController = require("../controllers/reviews.js");

router.post("/", isLoggedIn, isVerified, validateReview, wrapAsync(reviewController.createReview));
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviewController.destroyReview));

module.exports = router;