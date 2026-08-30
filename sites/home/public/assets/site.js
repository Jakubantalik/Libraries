/* Libraries.dev — shared nav behaviors (mobile menu, 3-dot menu,
 * ⌘K palette, GitHub stars). Ported from transitions.dev inline
 * scripts; theme handling removed (site is dark-only). */
(function () {
  "use strict";

  /* ── Mobile menu ─────────────────────────────────────────── */
  var burger = document.getElementById("nav-burger");
  var backdrop = document.getElementById("mobile-menu-backdrop");
  var CLOSE_MS = 300;
  var closeTimer = null;

  function openMenu() {
    document.body.classList.remove("menu-closing");
    document.body.classList.add("menu-open");
    if (burger) burger.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    if (!document.body.classList.contains("menu-open")) return;
    document.body.classList.remove("menu-open");
    document.body.classList.add("menu-closing");
    if (burger) burger.setAttribute("aria-expanded", "false");
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      document.body.classList.remove("menu-closing");
    }, CLOSE_MS);
  }
  if (burger) {
    burger.addEventListener("click", function () {
      document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
    });
  }
  if (backdrop) backdrop.addEventListener("click", closeMenu);
  document.querySelectorAll(".mobile-menu-link, .mobile-menu-cta").forEach(function (el) {
    el.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 639) {
      document.body.classList.remove("menu-open", "menu-closing");
      if (burger) burger.setAttribute("aria-expanded", "false");
    }
  });

  /* ── 3-dot menu ──────────────────────────────────────────── */
  var moreBtn = document.getElementById("more-btn");
  var moreMenu = document.getElementById("more-menu");
  var MENU_CLOSE_MS = 150;
  var menuCloseTimer = null;

  function menuIsOpen() { return moreMenu && moreMenu.classList.contains("is-open"); }
  function openMore() {
    if (!moreMenu) return;
    clearTimeout(menuCloseTimer);
    moreMenu.classList.remove("is-closing");
    moreMenu.classList.add("is-open");
    if (moreBtn) moreBtn.setAttribute("aria-expanded", "true");
  }
  function closeMore() {
    if (!menuIsOpen()) return;
    moreMenu.classList.remove("is-open");
    moreMenu.classList.add("is-closing");
    if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
    clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(function () {
      moreMenu.classList.remove("is-closing");
    }, MENU_CLOSE_MS);
  }
  if (moreBtn) {
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      menuIsOpen() ? closeMore() : openMore();
    });
    document.addEventListener("click", function (e) {
      if (menuIsOpen() && !moreMenu.contains(e.target)) closeMore();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMore();
    });
  }

  /* ── ⌘K command palette ──────────────────────────────────── */
  var PAGES = [
    { label: "Home", href: "/" },
    { label: "Beam", href: "/beam.html" },
    { label: "Orb", href: "/orbs.html" },
    { label: "Gooey", href: "/gooey.html" },
    { label: "Metal", href: "/metal.html" },
    { label: "Image", href: "/image.html" },
    { label: "Studio", href: "/studio.html" },
    { label: "Libraries Pro", href: "/pro.html" }
  ];
  var ACTIONS = [
    { label: "Get Pro access", href: "/pro.html" },
    { label: "View on GitHub", href: "https://github.com/Jakubantalik/Libraries", external: true },
    { label: "Contact support", href: "mailto:jakubja@gmail.com" }
  ];

  var searchBtn = document.getElementById("nav-search-btn");
  var kbdEl = document.getElementById("nav-search-kbd");
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  if (kbdEl) kbdEl.textContent = isMac ? "⌘K" : "Ctrl K";

  var overlay = null, input = null, listEl = null, activeIdx = 0, items = [];

  function buildPalette() {
    overlay = document.createElement("div");
    overlay.className = "cmdk-overlay";
    overlay.innerHTML =
      '<div class="cmdk-panel" role="dialog" aria-label="Search">' +
      '<div class="cmdk-search">' +
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5"/><path d="M14 14l-3.5-3.5"/></svg>' +
      '<input class="cmdk-input" type="text" placeholder="Search libraries, pages…" aria-label="Search" />' +
      '<span class="cmdk-esc">Esc</span>' +
      "</div>" +
      '<div class="cmdk-list" role="listbox"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    input = overlay.querySelector(".cmdk-input");
    listEl = overlay.querySelector(".cmdk-list");
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePalette();
    });
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        var el = items[activeIdx];
        if (el) el.click();
      }
    });
    render("");
  }

  function makeItem(entry, group) {
    var a = document.createElement("a");
    a.className = "cmdk-item";
    a.href = entry.href;
    if (entry.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.innerHTML = '<span class="cmdk-item-label"></span><span class="cmdk-item-hint">' + group + "</span>";
    a.querySelector(".cmdk-item-label").textContent = entry.label;
    return a;
  }

  function render(q) {
    if (!listEl) return;
    q = (q || "").trim().toLowerCase();
    listEl.innerHTML = "";
    items = [];
    activeIdx = 0;
    var groups = [
      { name: "Pages", entries: PAGES },
      { name: "Actions", entries: ACTIONS }
    ];
    groups.forEach(function (g) {
      var matched = g.entries.filter(function (e) {
        return !q || e.label.toLowerCase().indexOf(q) !== -1;
      });
      if (!matched.length) return;
      var label = document.createElement("div");
      label.className = "cmdk-group-label";
      label.textContent = g.name;
      listEl.appendChild(label);
      matched.forEach(function (entry) {
        var el = makeItem(entry, g.name);
        listEl.appendChild(el);
        items.push(el);
      });
    });
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "cmdk-empty";
      empty.textContent = "No results";
      listEl.appendChild(empty);
    }
    highlight();
  }

  function highlight() {
    items.forEach(function (el, i) {
      el.setAttribute("data-active", i === activeIdx ? "true" : "false");
    });
  }
  function move(d) {
    if (!items.length) return;
    activeIdx = (activeIdx + d + items.length) % items.length;
    highlight();
    items[activeIdx].scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    if (!overlay) buildPalette();
    overlay.setAttribute("data-open", "true");
    input.value = "";
    render("");
    requestAnimationFrame(function () { input.focus(); });
  }
  function closePalette() {
    if (overlay) overlay.removeAttribute("data-open");
  }

  if (searchBtn) searchBtn.addEventListener("click", openPalette);
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      overlay && overlay.getAttribute("data-open") === "true" ? closePalette() : openPalette();
    } else if (e.key === "Escape") {
      closePalette();
    }
  });

  /* ── GitHub stars ────────────────────────────────────────── */
  var starsBtn = document.getElementById("gh-stars-btn");
  var starsCount = document.getElementById("gh-stars-count");
  var GH_REPO = "Jakubantalik/Libraries";
  var GH_KEY = "ldev:gh-stars";
  var GH_TTL = 5 * 60 * 1000;

  function fmtStars(n) {
    if (n >= 1000) return (Math.round(n / 100) / 10) + "k";
    return String(n);
  }
  function setStars(n) {
    if (starsCount) starsCount.textContent = fmtStars(n);
    if (starsBtn) starsBtn.removeAttribute("data-loading");
  }
  if (starsBtn && starsCount) {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(GH_KEY) || "null"); } catch (e) {}
    if (cached && Date.now() - cached.t < GH_TTL) {
      setStars(cached.n);
    } else {
      fetch("https://api.github.com/repos/" + GH_REPO)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (typeof d.stargazers_count === "number") {
            try { sessionStorage.setItem(GH_KEY, JSON.stringify({ n: d.stargazers_count, t: Date.now() })); } catch (e) {}
            setStars(d.stargazers_count);
          } else if (cached) { setStars(cached.n); }
          else { if (starsCount) starsCount.textContent = "Star"; if (starsBtn) starsBtn.removeAttribute("data-loading"); }
        })
        .catch(function () {
          if (cached) setStars(cached.n);
          else { if (starsCount) starsCount.textContent = "Star"; if (starsBtn) starsBtn.removeAttribute("data-loading"); }
        });
    }
  }

  /* ── Copy buttons (per-card) ─────────────────────────────── */
  /* Every .card-copy with data-copy-text (or data-copy-target
     pointing at a <script type="text/plain">) gets the tooltip +
     copied-state behavior from transitions.dev. */
  document.querySelectorAll(".card-copy").forEach(function (btn) {
    var tip = document.createElement("span");
    tip.className = "card-copy-tooltip";
    tip.setAttribute("aria-hidden", "true");
    tip.innerHTML =
      '<span class="tt-text">Cop<span class="tt-swap"><span class="tt-label tt-a">y code</span><span class="tt-label tt-b">ied</span></span></span>';
    btn.appendChild(tip);
    var swap = tip.querySelector(".tt-swap");
    var a = tip.querySelector(".tt-a");
    var b = tip.querySelector(".tt-b");
    requestAnimationFrame(function () {
      var wa = a.getBoundingClientRect().width;
      var prevPos = b.style.position;
      b.style.position = "static";
      a.style.display = "none";
      var wb = b.getBoundingClientRect().width;
      a.style.display = "";
      b.style.position = prevPos;
      swap.style.setProperty("--tt-w-a", wa + "px");
      swap.style.setProperty("--tt-w-b", wb + "px");
    });
    var resetTimer = null;
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy-text");
      if (!text) {
        var sel = btn.getAttribute("data-copy-target");
        if (sel) {
          var src = document.querySelector(sel);
          if (src) text = src.textContent;
        }
      }
      if (!text) return;
      navigator.clipboard && navigator.clipboard.writeText(text).catch(function () {});
      btn.setAttribute("data-copied", "true");
      swap.setAttribute("data-state", "copied");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        btn.removeAttribute("data-copied");
        swap.removeAttribute("data-state");
      }, 1600);
    });
  });
})();
