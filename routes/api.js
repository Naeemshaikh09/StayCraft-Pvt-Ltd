const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const Listing = require("../models/listing");
const { geocodeMany, reverseGeocode } = require("../utils/geocode");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePrice(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/* ===========================
   Discovery cache (top cats/locs)
   =========================== */
let DISCOVERY_CACHE = { categories: [], locations: [], expiresAt: 0 };

async function getTopCategories(limit = 10) {
  const agg = await Listing.aggregate([
    { $match: { category: { $type: "string", $ne: "" } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return agg.map((x) => x._id);
}

async function getTopLocations(limit = 10) {
  const agg = await Listing.aggregate([
    {
      $match: {
        location: { $type: "string", $ne: "" },
        country: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: { location: "$location", country: "$country" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return agg.map((x) => ({
    location: x._id.location,
    country: x._id.country,
    count: x.count,
  }));
}

router.get("/discovery/top", async (req, res) => {
  const now = Date.now();
  if (DISCOVERY_CACHE.expiresAt > now) {
    return res.json({
      categories: DISCOVERY_CACHE.categories,
      locations: DISCOVERY_CACHE.locations,
    });
  }

  const limitCats = Math.max(1, Math.min(20, Number(req.query.limitCats) || 8));
  const limitLocs = Math.max(1, Math.min(20, Number(req.query.limitLocs) || 8));

  const [categories, locations] = await Promise.all([
    getTopCategories(limitCats),
    getTopLocations(limitLocs),
  ]);

  DISCOVERY_CACHE = {
    categories,
    locations,
    expiresAt: now + 5 * 60 * 1000,
  };

  return res.json({ categories, locations });
});

router.get("/categories/top", async (req, res) => {
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 8));
  const categories = await getTopCategories(limit);
  return res.json({ categories });
});

router.get("/listings/suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ results: [] });

  const requestedCategory = (req.query.category || "").trim();
  const categoriesEnum = Listing.schema.path("category")?.enumValues || [];
  const category = categoriesEnum.includes(requestedCategory) ? requestedCategory : "";

  let minPrice = parsePrice(req.query.minPrice);
  let maxPrice = parsePrice(req.query.maxPrice);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    const t = minPrice;
    minPrice = maxPrice;
    maxPrice = t;
  }

  let qSearch = q;
  let categoryFromQ = "";
  const exactCat = categoriesEnum.find((c) => c.toLowerCase() === q.toLowerCase());
  if (exactCat) {
    categoryFromQ = exactCat;
    qSearch = "";
  }

  const filter = {};
  const finalCategory = categoryFromQ || category;
  if (finalCategory) filter.category = finalCategory;

  if (qSearch.length) {
    const regex = new RegExp(escapeRegex(qSearch), "i");
    filter.$or = [{ title: regex }, { location: regex }, { country: regex }, { category: regex }];
  }

  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = minPrice;
    if (maxPrice != null) filter.price.$lte = maxPrice;
  }

  const results = await Listing.find(filter)
    .select("title location country category price image.url")
    .limit(8)
    .lean();

  return res.json({ results });
});

/* ===========================
   Stadia geocode protection (free plan)
   =========================== */
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const GEO_CACHE = new Map(); // key -> { value, exp }
const GEO_TTL_MS = 10 * 60 * 1000;

function cacheGet(key) {
  const hit = GEO_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    GEO_CACHE.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value) {
  GEO_CACHE.set(key, { value, exp: Date.now() + GEO_TTL_MS });
}

/**
 * GET /api/geocode?text=...&size=6
 * Returns:
 *  { ok:true, results:[{lon,lat,label}, ...], lon, lat, label }
 * (lon/lat/label = first result, for backward compatibility)
 */
router.get("/geocode", geoLimiter, async (req, res) => {
  const text = (req.query.text || "").trim();
  const size = Math.max(1, Math.min(8, Number(req.query.size) || 6));

  if (text.length < 3) {
    return res.status(400).json({ ok: false, message: "Query too short", results: [] });
  }

  const cacheKey = `geo:${text.toLowerCase()}:${size}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const found = await geocodeMany(text, size);
    const results = found.map((r) => ({ lon: r.lon, lat: r.lat, label: r.label }));

    if (!results.length) {
      return res.status(404).json({ ok: false, message: "Location not found", results: [] });
    }

    const first = results[0];
    const payload = { ok: true, results, lon: first.lon, lat: first.lat, label: first.label };

    cacheSet(cacheKey, payload);
    return res.json(payload);
  } catch (e) {
    return res.status(404).json({ ok: false, message: "Location not found", results: [] });
  }
});

// GET /api/reverse-geocode?lon=...&lat=...
router.get("/reverse-geocode", geoLimiter, async (req, res) => {
  const lon = Number(req.query.lon);
  const lat = Number(req.query.lat);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return res.status(400).json({ ok: false, message: "Invalid coordinates" });
  }

  // cache by rounding to reduce spam + improve hit rate
  const cacheKey = `rev:${lon.toFixed(5)},${lat.toFixed(5)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const r = await reverseGeocode(lon, lat);
    if (!r) return res.status(404).json({ ok: false, message: "No result" });

    const payload = { ok: true, location: r.location, country: r.country, label: r.label };
    cacheSet(cacheKey, payload);
    return res.json(payload);
  } catch {
    return res.status(500).json({ ok: false, message: "Reverse geocoding failed" });
  }
});

module.exports = router;