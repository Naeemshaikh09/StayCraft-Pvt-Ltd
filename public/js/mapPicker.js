(() => {
  const mapEl = document.getElementById("pickMap");
  if (!mapEl) return;

  if (!window.maplibregl) {
    console.error("MapLibre is not loaded.");
    return;
  }

  const cfg = window.mapPickerConfig || {};
  const token = cfg.token || "";

  const lngInput = document.getElementById("pickLng");
  const latInput = document.getElementById("pickLat");
  const locateBtn = document.getElementById("locateBtn");
  const usePinBtn = document.getElementById("usePinBtn");
  const geoResults = document.getElementById("geoResults");
  const pinStatus = document.getElementById("pinStatus");

  const locField = document.getElementById("location");
  const countryField = document.getElementById("country");

  // If user manually types, don't overwrite automatically
  let userTyped = false;
  if (locField) locField.addEventListener("input", () => (userTyped = true));
  if (countryField) countryField.addEventListener("input", () => (userTyped = true));

  // small status helper
  let statusTimer = null;
  function showStatus(msg, type = "success") {
    if (!pinStatus) return;

    pinStatus.style.display = "block";
    pinStatus.textContent = msg;

    pinStatus.classList.remove("text-success", "text-danger", "text-muted");
    if (type === "error") pinStatus.classList.add("text-danger");
    else if (type === "info") pinStatus.classList.add("text-muted");
    else pinStatus.classList.add("text-success");

    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      pinStatus.style.display = "none";
      pinStatus.textContent = "";
    }, 2500);
  }

  const styleUrl = `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${token}`;

  const startLng = (typeof cfg.lng === "number") ? cfg.lng : 0;
  const startLat = (typeof cfg.lat === "number") ? cfg.lat : 0;
  const startZoom = (typeof cfg.lng === "number" && typeof cfg.lat === "number") ? 15 : 2;

  const map = new maplibregl.Map({
    container: "pickMap",
    style: styleUrl,
    center: [startLng, startLat],
    zoom: startZoom,
  });

  map.addControl(new maplibregl.NavigationControl());

  const marker = new maplibregl.Marker({ color: "red", draggable: true })
    .setLngLat([startLng, startLat])
    .addTo(map);

  function setHidden(lng, lat) {
    if (lngInput) lngInput.value = String(lng);
    if (latInput) latInput.value = String(lat);
  }

  // returns true if it filled something
  async function fillFromReverse(lng, lat, { force = false } = {}) {
    if (!locField || !countryField) return false;

    // automatic fill should not overwrite user typing
    if (!force && userTyped) return false;

    try {
      const resp = await fetch(
        `/api/reverse-geocode?lon=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}`
      );
      const data = await resp.json();
      if (!data.ok) return false;

      const loc = (data.location || "").trim();
      const ctry = (data.country || "").trim();

      let changed = false;

      if (force) {
        if (loc) { locField.value = loc; changed = true; }
        if (ctry) { countryField.value = ctry; changed = true; }
        userTyped = false; // user chose to trust the pin
      } else {
        if (!locField.value.trim() && loc) { locField.value = loc; changed = true; }
        if (!countryField.value.trim() && ctry) { countryField.value = ctry; changed = true; }
      }

      return changed;
    } catch {
      return false;
    }
  }

  // Prefill hidden inputs on edit page if coords exist
  if (typeof cfg.lng === "number" && typeof cfg.lat === "number") {
    setHidden(cfg.lng, cfg.lat);
  }

  function hideResults() {
    if (!geoResults) return;
    geoResults.style.display = "none";
    geoResults.innerHTML = "";
  }

  function showResults(results) {
    if (!geoResults) return;
    geoResults.innerHTML = "";

    results.forEach((r) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action";
      btn.textContent = r.label;

      btn.addEventListener("click", async () => {
        marker.setLngLat([r.lon, r.lat]);
        map.flyTo({ center: [r.lon, r.lat], zoom: 15 });
        setHidden(r.lon, r.lat);
        await fillFromReverse(r.lon, r.lat, { force: false });
        hideResults();
      });

      geoResults.appendChild(btn);
    });

    geoResults.style.display = "block";
  }

  marker.on("dragend", async () => {
    const p = marker.getLngLat();
    setHidden(p.lng, p.lat);
    await fillFromReverse(p.lng, p.lat, { force: false });
  });

  map.on("click", async (e) => {
    const { lng, lat } = e.lngLat;
    marker.setLngLat([lng, lat]);
    setHidden(lng, lat);
    await fillFromReverse(lng, lat, { force: false });
  });

  async function locateFromText() {
    const location = (locField?.value || "").trim();
    const country = (countryField?.value || "").trim();
    const text = [location, country].filter(Boolean).join(", ");
    if (text.length < 3) return;

    try {
      const resp = await fetch(`/api/geocode?text=${encodeURIComponent(text)}&size=6`);
      const data = await resp.json();
      if (!data.ok) return;

      const results = Array.isArray(data.results) ? data.results : [];

      if (results.length <= 1) {
        const lon = data.lon;
        const lat = data.lat;
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

        marker.setLngLat([lon, lat]);
        map.flyTo({ center: [lon, lat], zoom: 15 });
        setHidden(lon, lat);
        await fillFromReverse(lon, lat, { force: false });
        hideResults();
      } else {
        showResults(results);
      }
    } catch {
      // ignore
    }
  }

  if (locateBtn) {
    locateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      locateFromText();
    });
  }

  // ✅ Force overwrite using current marker position + show success message
  if (usePinBtn) {
    usePinBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const p = marker.getLngLat();
      const ok = await fillFromReverse(p.lng, p.lat, { force: true });
      if (ok) showStatus("Pin address applied", "success");
      else showStatus("Could not apply pin address", "error");
    });
  }

  document.addEventListener("click", (e) => {
    if (!geoResults) return;
    if (geoResults.style.display === "none") return;
    if (geoResults.contains(e.target) || e.target === locateBtn) return;
    hideResults();
  });
})();