// Bootstrap validation
(() => {
  "use strict";

  const forms = document.querySelectorAll(".needs-validation");
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add("was-validated");
      },
      false
    );
  });
})();

// Reveal animation for listing cards
(() => {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  items.forEach((el) => io.observe(el));
})();

// Price button label live update (only on index page where price filter exists)
(() => {
  const minEl = document.getElementById("minPrice");
  const maxEl = document.getElementById("maxPrice");
  const btn = document.getElementById("priceBtn");
  const label = document.getElementById("priceBtnLabel");

  if (!minEl || !maxEl || !btn || !label) return;

  function formatLabel(minVal, maxVal) {
    const min = (minVal || "").trim();
    const max = (maxVal || "").trim();
    const has = min !== "" || max !== "";

    if (!has) return { has: false, text: "Price" };

    const left = min !== "" ? min : "0";
    const right = max !== "" ? max : "∞";
    return { has: true, text: `₹${left} - ₹${right}` };
  }

  function update() {
    const { has, text } = formatLabel(minEl.value, maxEl.value);
    label.textContent = text;

    btn.classList.toggle("btn-brand", has);
    btn.classList.toggle("btn-outline-brand", !has);
  }

  minEl.addEventListener("input", update);
  maxEl.addEventListener("input", update);
  update();
})();

// Taxes toggle (works for BOTH desktop + mobile toggles using class .js-tax-toggle)
(() => {
  const toggles = document.querySelectorAll(".js-tax-toggle");
  if (!toggles.length) return;

  const taxEls = () => document.querySelectorAll(".tax-info");

  function apply(on) {
    taxEls().forEach((el) => {
      el.style.display = on ? "inline" : "none";
    });

    toggles.forEach((t) => {
      if (t.checked !== on) t.checked = on;
    });
  }

  // remember user choice
  const saved = localStorage.getItem("sc_show_taxes");
  const initial = saved === "1" ? true : saved === "0" ? false : false;

  apply(initial);

  toggles.forEach((t) => {
    t.addEventListener("change", () => {
      const on = t.checked;
      localStorage.setItem("sc_show_taxes", on ? "1" : "0");
      apply(on);
    });
  });
})();

// Modern flash toasts: auto-hide + close + keep below header
(() => {
  const stack = document.getElementById("flashStack");
  if (!stack) return;

  function visibleHeaderHeight() {
    const desktop = document.querySelector("nav.navbar.sticky-top.d-none.d-md-block");
    const mobile = document.querySelector("nav.mobile-topbar.d-md-none");

    const header =
      (desktop && desktop.offsetParent !== null) ? desktop :
      (mobile && mobile.offsetParent !== null) ? mobile :
      null;

    return header ? Math.ceil(header.getBoundingClientRect().height) : 0;
  }

  function setFlashTop() {
    const h = visibleHeaderHeight();
    document.documentElement.style.setProperty("--sc-flash-top", `${h + 12}px`);
  }

  function dismiss(toast) {
    if (!toast) return;
    toast.classList.add("is-hiding");
    setTimeout(() => toast.remove(), 230);
  }

  setFlashTop();
  window.addEventListener("resize", setFlashTop);

  // click close
  stack.addEventListener("click", (e) => {
    const btn = e.target.closest(".sc-toast__close");
    if (!btn) return;
    dismiss(btn.closest(".sc-toast"));
  });

  // auto-hide
  stack.querySelectorAll(".sc-toast").forEach((toast) => {
    requestAnimationFrame(() => toast.classList.add("is-in"));
    const ms = Number(toast.dataset.autohide || 0);
    if (!ms) return;
    setTimeout(() => dismiss(toast), ms);
  });
})();