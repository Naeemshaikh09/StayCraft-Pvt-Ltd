// public/js/map.js
(() => {
  if (!window.mapConfig) return;

  const { token, lng, lat, title, subtitle } = window.mapConfig;

  if (!window.maplibregl) {
    console.error("MapLibre is not loaded.");
    return;
  }

  // If coords are default [0,0], don't render a misleading map
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
    const el = document.getElementById("map");
    if (el) el.innerHTML = "<div class='text-muted'>Map location not available.</div>";
    return;
  }

  const styleUrl = `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${token}`;

  const map = new maplibregl.Map({
    container: "map",
    style: styleUrl,
    center: [lng, lat],
    zoom: 11, // ✅ more “exact” than 9
  });

  map.addControl(new maplibregl.NavigationControl());

  const popupHtml = `
    <div style="min-width:180px">
      <div style="font-weight:800">${title || "Listing"}</div>
      <div style="color:#6b7280;font-size:0.9rem">${subtitle || ""}</div>
    </div>
  `;

  new maplibregl.Marker({ color: "red" })
    .setLngLat([lng, lat])
    .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
    .addTo(map);
})();