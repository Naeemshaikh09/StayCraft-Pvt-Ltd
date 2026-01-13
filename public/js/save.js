(() => {
  async function postToggleSave(listingId, csrfToken) {
    const resp = await fetch(`/listings/${listingId}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({ _csrf: csrfToken }).toString(),
    });

    if (resp.redirected) {
      window.location.href = resp.url;
      return null;
    }

    return resp.json();
  }

  // Index + Saved page buttons
  document.addEventListener("pointerdown", async (e) => {
    const btn = e.target.closest(".js-save-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const listingId = btn.dataset.id;
    const csrfToken = btn.dataset.csrf;
    if (!listingId || !csrfToken) return;

    const removeOnUnsave = btn.dataset.removeOnUnsave === "1";

    btn.disabled = true;
    try {
      const data = await postToggleSave(listingId, csrfToken);
      if (!data || !data.ok) return;

      // If this is a Saved page card, remove it from UI when unsaved
      if (removeOnUnsave && data.saved === false) {
        const col = btn.closest(".col");
        if (col) col.remove();
        return;
      }

      // Normal toggle UI
      btn.classList.toggle("is-saved", data.saved);
      btn.setAttribute("aria-label", data.saved ? "Unsave listing" : "Save listing");

      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-solid", data.saved);
        icon.classList.toggle("fa-regular", !data.saved);
      }
    } finally {
      btn.disabled = false;
    }
  });

  // Show page save form (AJAX submit)
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest(".js-save-form");
    if (!form) return;

    e.preventDefault();

    const action = form.getAttribute("action") || "";
    const m = action.match(/\/listings\/([^/]+)\/save/);
    const listingId = m ? m[1] : null;

    const csrfInput = form.querySelector('input[name="_csrf"]');
    const csrfToken = csrfInput ? csrfInput.value : null;
    if (!listingId || !csrfToken) return;

    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;

    try {
      const data = await postToggleSave(listingId, csrfToken);
      if (!data || !data.ok) return;

      if (btn) {
        btn.classList.toggle("btn-brand", !data.saved);
        btn.classList.toggle("btn-outline-brand", data.saved);

        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.toggle("fa-solid", data.saved);
          icon.classList.toggle("fa-regular", !data.saved);
        }

        const text = btn.querySelector(".js-save-show-text");
        if (text) text.textContent = data.saved ? "Saved" : "Save";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
})();