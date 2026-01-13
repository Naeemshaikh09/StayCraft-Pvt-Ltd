(() => {
  const btn = document.getElementById("loadMoreBtn");
  const grid = document.getElementById("listingGrid");
  const rc = document.getElementById("resultsCountText");
  const hint = document.getElementById("mobilePageHint");

  if (!btn || !grid || !rc) return;

  let loading = false;

  function setButtonText(nextPage, totalPages) {
    btn.textContent = `Load more (Page ${nextPage} of ${totalPages})`;
  }

  async function loadNext() {
    if (loading) return;
    const nextUrl = btn.dataset.nextUrl;
    if (!nextUrl) return;

    loading = true;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Loading…";

    try {
      const resp = await fetch(nextUrl, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      const html = await resp.text();

      const doc = new DOMParser().parseFromString(html, "text/html");

      const newGrid = doc.getElementById("listingGrid");
      const newRc = doc.getElementById("resultsCountText");
      const newBtn = doc.getElementById("loadMoreBtn");

      if (!newGrid || !newRc) throw new Error("Missing grid in response");

      // append new cards
      const newCols = newGrid.querySelectorAll(":scope > .col");
      newCols.forEach((col) => {
        // animate reveal
        col.classList.add("reveal");
        grid.appendChild(col);
        requestAnimationFrame(() => col.classList.add("is-visible"));
      });

      // update results count from response
      rc.dataset.end = newRc.dataset.end || rc.dataset.end;
      rc.dataset.page = newRc.dataset.page || rc.dataset.page;
      rc.dataset.pages = newRc.dataset.pages || rc.dataset.pages;

      const endSpan = document.getElementById("scRangeEnd");
      if (endSpan) endSpan.textContent = rc.dataset.end;

      // update mobile page hint
      if (hint && rc.dataset.page && rc.dataset.pages) {
        hint.innerHTML = `Page <b>${rc.dataset.page}</b> of <b>${rc.dataset.pages}</b>`;
      }

      // update next url / button label
      if (newBtn && newBtn.dataset.nextUrl) {
        btn.dataset.nextUrl = newBtn.dataset.nextUrl;

        const nextPage = (Number(rc.dataset.page) || 1) + 1;
        const totalPages = Number(rc.dataset.pages) || 1;
        setButtonText(nextPage, totalPages);
      } else {
        // no more pages
        btn.dataset.nextUrl = "";
        btn.style.display = "none";
      }
    } catch (e) {
      console.error(e);
      btn.textContent = "Failed. Tap to retry";
      btn.disabled = false;
      loading = false;
      return;
    }

    btn.disabled = false;
    loading = false;
    if (btn.style.display !== "none") btn.textContent = oldText;
  }

  btn.addEventListener("click", loadNext);
})();