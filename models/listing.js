// models/listing.js
const mongoose = require("mongoose");
const Review = require("./review");
const schema = mongoose.Schema;

const listingSchema = new schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    image: {
      url: String,
      filename: String,
    },
    price: Number,
    location: String,
    country: String,

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    category: {
      type: String,
      enum: [
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
      ],
      default: "Trending",
    },

    reviews: [
      {
        type: schema.Types.ObjectId,
        ref: "Review",
      },
    ],

    owner: {
      type: schema.Types.ObjectId,
      ref: "User",
    },

    geometry: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
  },
  { timestamps: true } // ✅ adds createdAt, updatedAt
);

// ✅ Indexes (performance)
listingSchema.index({ category: 1, price: 1, _id: -1 });     // common filters + newest
listingSchema.index({ geometry: "2dsphere" });              // future geo queries
listingSchema.index(
  { title: "text", location: "text", country: "text", category: "text" },
  {
    name: "ListingTextIndex",
    weights: { title: 5, location: 3, country: 2, category: 2 },
  }
);

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;