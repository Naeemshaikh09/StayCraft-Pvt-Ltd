const Listing = require("../models/listing");
const { geocode } = require("../utils/geocode");
const User = require("../models/user");
const { cloudinary } = require("../cloudConfig");

function isCloudinaryImage(image) {
  return !!(image?.url && image?.filename && image.url.includes("res.cloudinary.com"));
}

async function deleteCloudinaryImage(image) {
  if (!isCloudinaryImage(image)) return;
  try {
    await cloudinary.v2.uploader.destroy(image.filename);
  } catch (err) {
    console.error("CLOUDINARY DELETE ERROR:", err.message);
  }
}

module.exports.indexListing = async (req, res) => {
  const q = (req.query.q || "").trim();
  const requestedCategory = (req.query.category || "").trim();

  // ✅ pagination
  const LIMIT = 50;
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);

  // ✅ saved-only filter
  const savedOnly = (req.query.saved || "").toString() === "1";

  // ✅ sort
  const sortParam = (req.query.sort || "newest").trim();
  const allowedSort = new Set(["newest", "priceAsc", "priceDesc", "ratingDesc"]);
  const sortKey = allowedSort.has(sortParam) ? sortParam : "newest";

  // price filters
  const minPriceRaw = (req.query.minPrice ?? "").toString().trim();
  const maxPriceRaw = (req.query.maxPrice ?? "").toString().trim();

  const minPriceNum = minPriceRaw === "" ? null : Number(minPriceRaw);
  const maxPriceNum = maxPriceRaw === "" ? null : Number(maxPriceRaw);

  let minPrice = Number.isFinite(minPriceNum) && minPriceNum >= 0 ? minPriceNum : null;
  let maxPrice = Number.isFinite(maxPriceNum) && maxPriceNum >= 0 ? maxPriceNum : null;

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    const t = minPrice;
    minPrice = maxPrice;
    maxPrice = t;
  }

  const categories = Listing.schema.path("category")?.enumValues || [];
  let category = categories.includes(requestedCategory) ? requestedCategory : "";

  // if user typed exact category in q, treat it like category filter
  let qSearch = q;
  if (!category && q) {
    const match = categories.find((c) => c.toLowerCase() === q.toLowerCase());
    if (match) {
      category = match;
      qSearch = "";
    }
  }

  const filter = {};

  if (category) filter.category = category;

  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = minPrice;
    if (maxPrice != null) filter.price.$lte = maxPrice;
  }

  // search strategy: short => regex, long => $text
  const useTextSearch = qSearch.length >= 3;
  if (qSearch.length) {
    if (useTextSearch) {
      filter.$text = { $search: qSearch };
    } else {
      const escaped = qSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ title: regex }, { location: regex }, { country: regex }, { category: regex }];
    }
  }

  // Load saved ids (for icons + saved-only filter)
  let savedIds = [];
  let savedObjIds = [];
  if (req.user) {
    const savedUser = await User.findById(req.user._id).select("savedListings").lean();
    savedObjIds = savedUser?.savedListings || [];
    savedIds = savedObjIds.map((x) => x.toString());
  }

  if (savedOnly && !req.user) {
    req.flash("error", "Please log in to view saved listings.");
    return res.redirect("/login");
  }

  // apply savedOnly filter
  if (savedOnly) {
    filter._id = { $in: savedObjIds };
    if (!savedObjIds.length) {
      return res.render("Listings/index.ejs", {
        allListings: [],
        q,
        category,
        categories,
        minPrice: minPrice ?? "",
        maxPrice: maxPrice ?? "",
        savedIds,
        sort: sortKey,
        savedOnly,
        page: 1,
        totalPages: 1,
        totalCount: 0,
        rangeStart: 0,
        rangeEnd: 0,
      });
    }
  }

  // apply sort
  let sort = { _id: -1 };
  if (sortKey === "priceAsc") sort = { price: 1, _id: -1 };
  if (sortKey === "priceDesc") sort = { price: -1, _id: -1 };
  if (sortKey === "ratingDesc") sort = { ratingAvg: -1, ratingCount: -1, _id: -1 };

  // prefer relevance only when user chose "newest"
  const useRelevance = !!filter.$text && sortKey === "newest";
  if (useRelevance) sort = { score: { $meta: "textScore" }, _id: -1 };

  // total count for pagination
  const totalCount = await Listing.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  if (page > totalPages) page = totalPages;
  const skip = (page - 1) * LIMIT;

  // projection: keep index light
  let query = Listing.find(filter)
    .select("title location country price category image.url ratingAvg ratingCount")
    .sort(sort)
    .skip(skip)
    .limit(LIMIT)
    .lean();

  if (useRelevance) {
    query = Listing.find(filter)
      .select("title location country price category image.url ratingAvg ratingCount")
      .select({ score: { $meta: "textScore" } })
      .sort(sort)
      .skip(skip)
      .limit(LIMIT)
      .lean();
  }

  const allListings = await query;

  const rangeStart = totalCount === 0 ? 0 : skip + 1;
  const rangeEnd = totalCount === 0 ? 0 : skip + allListings.length;

  return res.render("Listings/index.ejs", {
    allListings,
    q,
    category,
    categories,
    minPrice: minPrice ?? "",
    maxPrice: maxPrice ?? "",
    savedIds,
    sort: sortKey,
    savedOnly,
    page,
    totalPages,
    totalCount,
    rangeStart,
    rangeEnd,
  });
};
// باقي الكود كما هو...
module.exports.renderNew = (req, res) => res.render("Listings/new.ejs");

module.exports.showRoute = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }

  let isSaved = false;
  if (req.user) {
    const user = await User.findById(req.user._id).select("savedListings");
    isSaved = user.savedListings.some((lid) => lid.equals(listing._id));
  }

  return res.render("Listings/show.ejs", { listing, isSaved });
};

module.exports.createRoute = async (req, res) => {
  const incoming = req.body.listing || {};

  // ✅ read manual coordinates from map picker (if user set them)
  const lng = parseFloat(incoming?.geometry?.coordinates?.[0]);
  const lat = parseFloat(incoming?.geometry?.coordinates?.[1]);
  const hasManualCoords = Number.isFinite(lng) && Number.isFinite(lat);

  // ✅ do NOT pass geometry directly into mongoose update/create (avoid "" -> 0 issues)
  const listingData = { ...incoming };
  delete listingData.geometry;

  let url = null;
  let filename = null;
  if (req.file) {
    url = req.file.path || req.file.url || req.file.secure_url;
    filename = req.file.filename || req.file.public_id;
  }

  const newListing = new Listing(listingData);
  newListing.owner = req.user._id;

  if (url && filename) newListing.image = { url, filename };

  // ✅ geometry: prefer manual coords, else geocode text
  if (hasManualCoords) {
    newListing.geometry = {
      type: "Point",
      coordinates: [lng, lat],
    };
  } else {
    const query = `${listingData.location}, ${listingData.country}`;
    let coords;

    try {
      coords = await geocode(query);
    } catch (e) {
      req.flash("error", "Could not find that location on the map.");
      return res.redirect("/listings/new");
    }

    newListing.geometry = {
      type: "Point",
      coordinates: [coords.lon, coords.lat],
    };
  }

  await newListing.save();

  req.flash("success", "New listing created!");
  return res.redirect(`/listings/${newListing._id}`);
};

module.exports.editRoute = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image?.url || null;
  if (originalImageUrl) {
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250/f_auto");
  }

  return res.render("Listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateRoute = async (req, res) => {
  const { id } = req.params;

  const existing = await Listing.findById(id);
  if (!existing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  const incoming = req.body.listing || {};

  // ✅ read manual coordinates from map picker (if user set them)
  const lng = parseFloat(incoming?.geometry?.coordinates?.[0]);
  const lat = parseFloat(incoming?.geometry?.coordinates?.[1]);
  const hasManualCoords = Number.isFinite(lng) && Number.isFinite(lat);

  // ✅ do NOT update geometry directly from req.body
  const updateData = { ...incoming };
  delete updateData.geometry;

  const locationChanged =
    (updateData.location && updateData.location !== existing.location) ||
    (updateData.country && updateData.country !== existing.country);

  // update fields first (not geometry)
  let listing = await Listing.findByIdAndUpdate(id, updateData, { new: true });

  // ✅ geometry priority:
  // 1) if user pinned coords -> use them
  // 2) else if location text changed -> geocode
  if (hasManualCoords) {
    listing.geometry = {
      type: "Point",
      coordinates: [lng, lat],
    };
    await listing.save();
  } else if (locationChanged) {
    const query = `${listing.location}, ${listing.country}`;
    try {
      const coords = await geocode(query);
      listing.geometry = {
        type: "Point",
        coordinates: [coords.lon, coords.lat],
      };
      await listing.save();
    } catch (e) {
      req.flash("error", "Could not find that location on the map.");
      return res.redirect(`/listings/${id}/edit`);
    }
  }

  // image update
  if (req.file) {
    const url = req.file.path || req.file.url || req.file.secure_url;
    const filename = req.file.filename || req.file.public_id;

    if (url && filename) {
      const oldImage = listing.image;
      await deleteCloudinaryImage(oldImage);

      listing.image = { url, filename };
      await listing.save();
    }
  }

  req.flash("success", "Listing updated!");
  return res.redirect(`/listings/${id}`);
};

module.exports.destroyRoute = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  // ✅ delete cloudinary image (if it is cloudinary)
  await deleteCloudinaryImage(listing.image);

  // ✅ keep using findByIdAndDelete so your review cleanup hook works
  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing deleted!");
  return res.redirect("/listings");
};

module.exports.toggleSave = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);
  if (!listing) {
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(404).json({ ok: false, message: "Listing not found." });
    }
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  const user = await User.findById(req.user._id);

  const alreadySaved = user.savedListings.some((lid) => lid.equals(id));

  let saved;
  if (alreadySaved) {
    user.savedListings = user.savedListings.filter((lid) => !lid.equals(id));
    saved = false;
  } else {
    user.savedListings.push(id);
    saved = true;
  }

  await user.save();

  // ✅ If AJAX request, return JSON (no redirect, no flash)
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.json({ ok: true, saved });
  }

  // normal form submit fallback
  req.flash("success", saved ? "Saved listing." : "Removed from Saved.");
  return res.redirect(req.get("Referrer") || `/listings/${id}`);
};