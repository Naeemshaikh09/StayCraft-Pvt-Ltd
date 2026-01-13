const Listing = require("../models/listing.js");
const Review = require("../models/review.js");

async function recalcListingRating(listingId) {
  const listing = await Listing.findById(listingId).select("reviews");
  if (!listing) return;

  if (!listing.reviews || listing.reviews.length === 0) {
    await Listing.findByIdAndUpdate(listingId, { ratingAvg: 0, ratingCount: 0 });
    return;
  }

  const stats = await Review.aggregate([
    { $match: { _id: { $in: listing.reviews } } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = stats[0]?.avg ?? 0;
  const count = stats[0]?.count ?? 0;

  await Listing.findByIdAndUpdate(listingId, {
    ratingAvg: avg,
    ratingCount: count,
  });
}

module.exports.createReview = async (req, res) => {
  let listing = await Listing.findById(req.params.id);
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;

  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  // ✅ update rating stats
  await recalcListingRating(listing._id);

  res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);

  // ✅ update rating stats
  await recalcListingRating(id);

  res.redirect(`/listings/${id}`);
};