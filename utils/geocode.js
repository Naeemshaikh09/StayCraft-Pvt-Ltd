// utils/geocode.js
const GEOCODE_TOKEN = process.env.MAP_GEOCODE_TOKEN || process.env.MAP_TOKEN;

if (!GEOCODE_TOKEN) {
  console.warn("[WARN] MAP_GEOCODE_TOKEN (or MAP_TOKEN) is not set in .env");
}

async function geocodeMany(query, size = 5) {
  if (!GEOCODE_TOKEN) throw new Error("MAP_GEOCODE_TOKEN environment variable is not set");

  const url = new URL("https://api.stadiamaps.com/geocoding/v1/search");
  url.searchParams.set("text", query);
  url.searchParams.set("api_key", GEOCODE_TOKEN);
  url.searchParams.set("size", String(Math.max(1, Math.min(8, size))));

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Stadia geocoding failed: ${resp.status} ${resp.statusText}`);

  const data = await resp.json();
  const feats = Array.isArray(data.features) ? data.features : [];
  if (!feats.length) return [];

  return feats.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const label = feature?.properties?.label || query;
    return { lat, lon, label, feature };
  });
}

async function geocode(query) {
  const results = await geocodeMany(query, 1);
  if (!results.length) throw new Error("No results found for that location");
  return results[0];
}

async function reverseGeocode(lon, lat) {
  if (!GEOCODE_TOKEN) throw new Error("MAP_GEOCODE_TOKEN environment variable is not set");

  const url = new URL("https://api.stadiamaps.com/geocoding/v1/reverse");
  url.searchParams.set("point.lon", String(lon));
  url.searchParams.set("point.lat", String(lat));
  url.searchParams.set("api_key", GEOCODE_TOKEN);
  url.searchParams.set("size", "1");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Stadia reverse geocoding failed: ${resp.status} ${resp.statusText}`);

  const data = await resp.json();
  const feature = data.features?.[0];
  if (!feature) return null;

  const props = feature.properties || {};
  const label = props.label || "";

  // Choose something sensible for your text fields:
  const location =
    props.locality ||
    props.county ||
    props.region ||
    props.neighbourhood ||
    props.label ||
    "";

  const country =
    props.country ||
    props.country_a ||
    "";

  return { label, location, country, feature };
}

module.exports = { geocode, geocodeMany, reverseGeocode };