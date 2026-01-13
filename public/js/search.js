(() => {
  const widgets = document.querySelectorAll(".js-sc-search");
  if (!widgets.length) return;

  let timer = null;

  // ---- discovery cache (client-side) ----
  let DISCOVERY = null;
  let DISCOVERY_EXPIRES_AT = 0;

  async function loadDiscovery() {
    const now = Date.now();
    if (DISCOVERY && DISCOVERY_EXPIRES_AT > now) return DISCOVERY;

    try {
      const resp = await fetch("/api/discovery/top?limitCats=12&limitLocs=12");
      const data = await resp.json();

      DISCOVERY = {
        categories: Array.isArray(data.categories) ? data.categories : [],
        locations: Array.isArray(data.locations) ? data.locations : [],
      };
      DISCOVERY_EXPIRES_AT = now + 5 * 60 * 1000; // 5 minutes
      return DISCOVERY;
    } catch {
      DISCOVERY = { categories: [], locations: [] };
      DISCOVERY_EXPIRES_AT = now + 60 * 1000;
      return DISCOVERY;
    }
  }

  function pickRelated(list, q, mapToSearchText) {
    const s = (q || "").trim().toLowerCase();
    const arr = list || [];

    let matches = s
      ? arr.filter((x) => mapToSearchText(x).toLowerCase().includes(s))
      : [];

    if (!matches.length) matches = arr;
    return matches.slice(0, 3);
  }

  async function fetchSuggest({ q, category, minPrice, maxPrice }) {
    const url = new URL("/api/listings/suggest", window.location.origin);
    url.searchParams.set("q", q);

    if (category) url.searchParams.set("category", category);
    if (minPrice) url.searchParams.set("minPrice", minPrice);
    if (maxPrice) url.searchParams.set("maxPrice", maxPrice);

    const resp = await fetch(url.toString());
    const data = await resp.json();
    return data.results || [];
  }

  widgets.forEach((form, formIndex) => {
    const input = form.querySelector(".sc-search-input");
    const box = form.querySelector(".sc-suggest");

    const catInput = form.querySelector('input[name="category"]');
    const minInput = form.querySelector('input[name="minPrice"]');
    const maxInput = form.querySelector('input[name="maxPrice"]');

    if (!input || !box) return;

    let currentResults = [];
    let activeIndex = -1;
    let lastQuery = "";

    const close = () => {
      box.classList.remove("show");
      box.innerHTML = "";
      currentResults = [];
      activeIndex = -1;
      lastQuery = "";
      input.removeAttribute("aria-activedescendant");
    };

    const setActive = (idx) => {
      const items = box.querySelectorAll(".sc-suggest-item[data-idx]");
      if (!items.length) {
        activeIndex = -1;
        input.removeAttribute("aria-activedescendant");
        return;
      }

      if (idx < 0) idx = items.length - 1;
      if (idx >= items.length) idx = 0;

      activeIndex = idx;

      items.forEach((el) => {
        const i = Number(el.getAttribute("data-idx"));
        const isActive = i === activeIndex;
        el.classList.toggle("active", isActive);
        el.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive) {
          input.setAttribute("aria-activedescendant", el.id);
          el.scrollIntoView({ block: "nearest" });
        }
      });
    };

    const goToActive = () => {
      if (activeIndex < 0 || activeIndex >= currentResults.length) return;
      const r = currentResults[activeIndex];
      if (!r?._id) return;
      window.location.href = `/listings/${r._id}`;
    };

    const submitCurrentForm = () => {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
    };

    const renderEmpty = async () => {
      box.innerHTML = "";
      currentResults = [];
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");

      const wrap = document.createElement("div");
      wrap.className = "sc-suggest-empty";

      const title = document.createElement("div");
      title.className = "sc-suggest-empty-title";
      title.textContent = "No results found";

      const sub = document.createElement("div");
      sub.className = "sc-suggest-empty-sub";
      sub.textContent = "Try one of these:";

      wrap.appendChild(title);
      wrap.appendChild(sub);

      const discovery = await loadDiscovery();

      // --- Categories section ---
      const catSection = document.createElement("div");
      catSection.className = "sc-suggest-empty-section";

      const catHeader = document.createElement("div");
      catHeader.className = "sc-suggest-empty-section-title";
      catHeader.textContent = "Top categories";

      const catChips = document.createElement("div");
      catChips.className = "sc-suggest-empty-chips";

      const topCats = pickRelated(discovery.categories, lastQuery, (x) => String(x));
      topCats.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sc-suggest-empty-chip";
        btn.textContent = c;

        // ✅ pointerdown fixes mobile "not redirect / not submit" issues
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          input.value = c;
          if (catInput) catInput.value = "";
          submitCurrentForm();
        });

        catChips.appendChild(btn);
      });

      catSection.appendChild(catHeader);
      catSection.appendChild(catChips);

      // --- Locations section ---
      const locSection = document.createElement("div");
      locSection.className = "sc-suggest-empty-section";

      const locHeader = document.createElement("div");
      locHeader.className = "sc-suggest-empty-section-title";
      locHeader.textContent = "Top locations";

      const locChips = document.createElement("div");
      locChips.className = "sc-suggest-empty-chips";

      const topLocs = pickRelated(
        discovery.locations,
        lastQuery,
        (x) => `${x.location}, ${x.country}`
      );

      topLocs.forEach((x) => {
        const label = `${x.location}, ${x.country}`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sc-suggest-empty-chip";
        btn.textContent = label;

        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          input.value = label;
          if (catInput) catInput.value = "";
          submitCurrentForm();
        });

        locChips.appendChild(btn);
      });

      locSection.appendChild(locHeader);
      locSection.appendChild(locChips);

      wrap.appendChild(catSection);
      wrap.appendChild(locSection);

      box.appendChild(wrap);
      box.classList.add("show");
    };

    const renderResults = async (results) => {
      box.innerHTML = "";
      currentResults = results || [];
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");

      if (!currentResults.length) {
        await renderEmpty();
        return;
      }

      currentResults.forEach((r, i) => {
        const item = document.createElement("div");
        item.className = "sc-suggest-item";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", "false");
        item.id = `sc-opt-${formIndex}-${i}`;
        item.setAttribute("data-idx", String(i));

        const imgUrl =
          r.image && r.image.url
            ? r.image.url
            : "https://source.unsplash.com/random/200x150?home";

        const cat = (r.category || "").trim();
        const loc = [r.location, r.country].filter(Boolean).join(", ");
        const price =
          r.price != null ? `₹${Number(r.price).toLocaleString("en-IN")}/night` : "";

        const metaText = [loc || null, price || null].filter(Boolean).join(" • ");

        const img = document.createElement("img");
        img.className = "sc-suggest-thumb";
        img.src = imgUrl;
        img.alt = "Listing";

        const right = document.createElement("div");
        right.style.minWidth = "0";

        const title = document.createElement("div");
        title.className = "sc-suggest-title";
        title.textContent = r.title || "Untitled";

        const sub = document.createElement("div");
        sub.className = "sc-suggest-sub";

        if (cat) {
          const badge = document.createElement("span");
          badge.className = "sc-suggest-badge";
          badge.textContent = cat;
          sub.appendChild(badge);
        }

        const meta = document.createElement("span");
        meta.className = "sc-suggest-meta";
        meta.textContent = metaText || "Location";
        sub.appendChild(meta);

        right.appendChild(title);
        right.appendChild(sub);

        item.appendChild(img);
        item.appendChild(right);

        item.addEventListener("mouseenter", () => setActive(i));

        // ✅ use pointerdown so it works reliably on mobile
        item.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = `/listings/${r._id}`;
        });

        box.appendChild(item);
      });

      box.classList.add("show");
    };

    async function runSuggestNow() {
      const q = input.value.trim();
      if (q.length < 2) return close();

      lastQuery = q;

      const category = catInput?.value?.trim() || "";
      const minPrice = minInput?.value?.trim() || "";
      const maxPrice = maxInput?.value?.trim() || "";

      const results = await fetchSuggest({ q, category, minPrice, maxPrice });
      await renderResults(results);
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) return close();

      lastQuery = q;

      const category = catInput?.value?.trim() || "";
      const minPrice = minInput?.value?.trim() || "";
      const maxPrice = maxInput?.value?.trim() || "";

      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const results = await fetchSuggest({ q, category, minPrice, maxPrice });
          await renderResults(results);
        } catch {
          close();
        }
      }, 250);
    });

    input.addEventListener("keydown", async (e) => {
      const isOpen = box.classList.contains("show");
      const itemsCount = currentResults.length;

      if (e.key === "Escape") return close();

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) {
          try { await runSuggestNow(); } catch { return; }
        }
        if (currentResults.length === 0) return;
        setActive(activeIndex === -1 ? 0 : activeIndex + 1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen || itemsCount === 0) return;
        setActive(activeIndex === -1 ? itemsCount - 1 : activeIndex - 1);
        return;
      }

      if (e.key === "Enter") {
        if (isOpen && activeIndex !== -1) {
          e.preventDefault();
          goToActive();
        }
      }
    });

    // click outside closes (keep this)
    document.addEventListener("click", (e) => {
      if (!form.contains(e.target)) close();
    });

    // ❌ REMOVE blur-close (it breaks clicking suggestions on mobile)
    // input.addEventListener("blur", ...)
  });
})();