/* Libraries.dev Pro — front-end client for the Pro platform API.
 *
 * Talks to the hosted Worker (api.libraries.dev in production, localhost:8787 in
 * local dev). Forked from transitions.dev's pro-client with three deliberate
 * differences:
 *   1. Sign-in is CODE-ONLY: the email carries a short typeable code, no link.
 *   2. Signed-in users get a letter AVATAR (first letter of their email) in the
 *      nav instead of a menu button; the avatar opens Account / Sign out.
 *   3. A purchase auto-creates the profile — email is the only identity.
 *
 * Session is a cookie on .libraries.dev, so every call uses credentials:"include".
 * All lookups are defensive: on a page missing an element, that piece no-ops.
 */
(function () {
  "use strict";

  var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "http://localhost:8787"
    : "https://api.libraries.dev";

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = "include";
    return fetch(API_BASE + path, opts);
  }
  function apiJSON(path, method, body) {
    return api(path, {
      method: method || "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  // `resolved` flips true only once /me has actually ANSWERED (2xx JSON) —
  // pages must not present a definitive "signed out" UI before that.
  var state = { authenticated: false, email: null, pro: false, lifetime: false, billing: false, subscription: null, ppp: null, resolved: false };

  // Last-known auth state, cached so a navigation paints the signed-in UI on
  // the FIRST frame instead of flashing the signed-out version for a /me
  // round-trip. Email is kept too — the avatar letter needs it before /me answers.
  var AUTH_CACHE_KEY = "ldev:auth";
  var AUTH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

  function readAuthCache() {
    try {
      var raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || typeof c.t !== "number" || Date.now() - c.t > AUTH_CACHE_TTL) return null;
      return c;
    } catch (e) { return null; }
  }
  function writeAuthCache() {
    try {
      var prev = readAuthCache();
      if (prev && !!prev.a === !!state.authenticated && !!prev.p === !!state.pro && prev.e === state.email) return;
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
        a: !!state.authenticated,
        p: !!state.pro,
        e: state.email || null,
        t: Date.now(),
      }));
    } catch (e) {}
  }
  function clearAuthCache() {
    try { localStorage.removeItem(AUTH_CACHE_KEY); } catch (e) {}
  }

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

  // Tiny global for page scripts (pricing page, success page, activate page).
  window.LibrariesPro = {
    apiBase: API_BASE,
    get state() { return state; },
    refresh: refreshMe,
    checkout: startCheckout,
    signIn: signIn,
    openSignIn: signIn,
    portal: startPortal,
    requestCode: requestCode,
    submitCode: submitCode,
    approveDevice: approveDevice,
    fetchContent: fetchProContent,
    logout: logout,
    signInFromCheckout: signInFromCheckout,
    refreshGeo: refreshGeo,
    get ppp() { return state.ppp; },
    get team() { return team; },
  };

  // ── Purchasing-power parity ────────────────────────────────────────────────
  // The discount auto-applies server-side at checkout by geo; the banner is
  // purely informational. Cached a day — a stale banner cannot mis-sell.
  var GEO_CACHE_KEY = "ldev:geo";
  var GEO_CACHE_TTL = 24 * 60 * 60 * 1000;

  function applyGeo(ppp) {
    state.ppp = ppp || null;
    renderPPP();
    document.dispatchEvent(new CustomEvent("pro:geo", { detail: state.ppp }));
    return state.ppp;
  }

  function refreshGeo(force) {
    if (!force) {
      try {
        var raw = localStorage.getItem(GEO_CACHE_KEY);
        var c = raw ? JSON.parse(raw) : null;
        if (c && typeof c.t === "number" && Date.now() - c.t < GEO_CACHE_TTL) {
          return Promise.resolve(applyGeo(c.ppp));
        }
      } catch (e) {}
    }
    return apiJSON("/geo").then(function (g) {
      var ppp = g && g.ppp ? g.ppp : null;
      try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ppp: ppp, t: Date.now() })); } catch (e) {}
      return applyGeo(ppp);
    }).catch(function () { return null; });
  }

  function renderPPP() {
    var slot = document.getElementById("pro-ppp");
    if (!slot) return;
    var p = state.ppp;
    if (!p) { slot.hidden = true; slot.innerHTML = ""; return; }
    var label =
      "We will apply " + esc(String(p.percent)) + "% parity discount in " +
      esc(p.name || p.country) + " in checkout";
    slot.innerHTML = '<div class="pro-ppp-bar">' + label + "</div>";
    slot.hidden = false;
  }

  // /me is the auth authority. Only a 2xx JSON answer may update the state —
  // a network failure or 5xx must NOT flip a signed-in user to signed out.
  var lastMeAt = 0;
  function refreshMe(attempt) {
    attempt = attempt || 0;
    lastMeAt = Date.now();
    return api("/me")
      .then(function (r) {
        // 429 means the throttle answered; retrying only makes it worse and the
        // state must stay exactly as the last good answer left it.
        if (r.status === 429) throw { rateLimited: true };
        if (!r.ok) throw new Error("me_" + r.status);
        return r.json();
      })
      .then(function (me) {
        state.authenticated = !!me.authenticated;
        state.email = me.email || null;
        state.pro = !!(me.entitlements && me.entitlements.pro);
        state.lifetime = !!me.lifetime;
        state.subscription = me.subscription || null;
        state.billing = !!me.billing;
        state.resolved = true;
        writeAuthCache();
        paintAuth();
        document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
        return state;
      })
      .catch(function (err) {
        if (err && err.rateLimited) {
          document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
          return state;
        }
        if (attempt < 2) {
          return new Promise(function (res) {
            setTimeout(function () { res(refreshMe(attempt + 1)); }, attempt === 0 ? 600 : 2000);
          });
        }
        document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
        return state;
      });
  }

  // Floor between background re-verifies; explicit calls bypass it. A cache /
  // state disagreement (sign-in from another tab) re-verifies immediately.
  var ME_MIN_AGE_MS = 60 * 1000;
  function refreshMeIfStale() {
    var cached = readAuthCache();
    var drift = cached && (!!cached.a !== state.authenticated || !!cached.p !== state.pro);
    if (!drift && Date.now() - lastMeAt < ME_MIN_AGE_MS) return Promise.resolve(state);
    return refreshMe();
  }

  // Cross-tab sign-in/out via the storage event.
  window.addEventListener("storage", function (e) {
    if (e.key !== AUTH_CACHE_KEY) return;
    var moved = true;
    if (e.newValue) {
      try {
        var c = JSON.parse(e.newValue);
        moved = !!c.a !== !!state.authenticated || !!c.p !== !!state.pro;
        state.authenticated = !!c.a;
        state.pro = !!c.p;
        if (c.e) state.email = c.e;
        paintAuth();
        document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
      } catch (err) {}
    }
    if (moved) refreshMe();
  });

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) refreshMeIfStale();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refreshMeIfStale();
  });

  // Sign out (this device, or all), locally-authoritative first.
  function logout(allDevices) {
    clearAuthCache();
    state.authenticated = false;
    state.pro = false;
    state.email = null;
    state.lifetime = false;
    state.billing = false;
    state.subscription = null;
    state.resolved = true;
    paintAuth();
    document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
    return api("/auth/logout" + (allDevices ? "?all=1" : ""), { method: "POST" })
      .then(function () { return refreshMe(); })
      .catch(function () { return state; });
  }

  // ── Nav auth slot: "Sign in" pill ⇄ letter avatar ──────────────────────────
  // Every page carries <div id="nav-auth"></div> in its nav. Signed out it
  // renders a "Sign in" pill (plus a "Get Pro" pill unless the page opts out
  // with data-no-getpro); signed in it renders a circular avatar with the
  // first letter of the email, opening a small Account / Sign out menu.
  function avatarLetter() {
    var e = state.email || "";
    return e ? e.charAt(0).toUpperCase() : "?";
  }

  function paintAuth() {
    var slot = document.getElementById("nav-auth");
    if (slot) {
      injectAuthStyle();
      if (state.authenticated) {
        var letter = esc(avatarLetter());
        slot.innerHTML =
          '<div class="lp-avatar-wrap">' +
            '<button type="button" class="lp-avatar" id="lp-avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">' + letter + "</button>" +
            '<div class="lp-avatar-menu" id="lp-avatar-menu" role="menu" hidden>' +
              '<div class="lp-avatar-email">' + esc(state.email || "") + "</div>" +
              '<a class="lp-avatar-item" role="menuitem" href="account.html">Account</a>' +
              '<button type="button" class="lp-avatar-item" role="menuitem" id="lp-avatar-signout">Sign out</button>' +
            "</div>" +
          "</div>";
        var btn = document.getElementById("lp-avatar-btn");
        var menu = document.getElementById("lp-avatar-menu");
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var open = !menu.hidden;
          menu.hidden = open;
          btn.setAttribute("aria-expanded", String(!open));
        });
        document.addEventListener("click", function () {
          if (!menu.hidden) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && !menu.hidden) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
        });
        document.getElementById("lp-avatar-signout").addEventListener("click", function () {
          logout(false).then(function () {
            if (/\/(account|activate)(\.html)?$/.test(location.pathname)) location.href = "/";
          });
        });
      } else {
        var getPro = slot.hasAttribute("data-no-getpro") ? "" :
          (state.pro ? "" : '<a class="lp-pill lp-pill--pro" href="pro.html">Get Pro</a>');
        slot.innerHTML =
          getPro +
          '<button type="button" class="lp-pill" id="lp-signin-btn">Sign in</button>';
        var signinBtn = document.getElementById("lp-signin-btn");
        if (signinBtn) signinBtn.addEventListener("click", function () { signIn(); });
      }
    }
    // Pricing CTA reflects entitlement: entitled users manage their plan.
    var cta = document.getElementById("pro-price-cta");
    if (cta && state.pro) {
      cta.textContent = "Manage subscription";
      cta.setAttribute("data-action", "portal");
    }
  }

  function injectAuthStyle() {
    if (document.getElementById("lp-auth-base")) return;
    var s = document.createElement("style");
    s.id = "lp-auth-base";
    s.textContent =
      "#nav-auth{display:flex;align-items:center;gap:10px}" +
      ".lp-pill{display:inline-flex;align-items:center;height:34px;padding:0 16px;border-radius:50px;" +
      "border:1px solid rgba(0,0,0,.12);background:transparent;color:inherit;cursor:pointer;text-decoration:none;" +
      "font:500 13px/1 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;transition:background 120ms ease,scale 120ms cubic-bezier(0.22,1,0.36,1)}" +
      ".lp-pill:hover{background:rgba(0,0,0,.05)}" +
      ".lp-pill:active{scale:.96}" +
      ".lp-pill--pro{background:#17181c;color:#fff;border-color:#17181c}" +
      ".lp-pill--pro:hover{background:#2a2b31}" +
      'html[data-theme="dark"] .lp-pill{border-color:rgba(255,255,255,.18)}' +
      'html[data-theme="dark"] .lp-pill:hover{background:rgba(255,255,255,.08)}' +
      'html[data-theme="dark"] .lp-pill--pro{background:#f2f2f2;color:#111;border-color:#f2f2f2}' +
      ".lp-avatar-wrap{position:relative}" +
      ".lp-avatar{width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;" +
      "background:#17181c;color:#fff;font:600 14px/1 Inter,ui-sans-serif,system-ui,sans-serif;" +
      "display:inline-flex;align-items:center;justify-content:center;" +
      "transition:scale 120ms cubic-bezier(0.22,1,0.36,1),opacity 120ms ease}" +
      ".lp-avatar:hover{opacity:.85}" +
      ".lp-avatar:active{scale:.92}" +
      'html[data-theme="dark"] .lp-avatar{background:#f2f2f2;color:#111}' +
      ".lp-avatar-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:200px;z-index:1000;" +
      "background:#fff;color:#0d0d0d;border-radius:16px;padding:6px;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.06)}" +
      'html[data-theme="dark"] .lp-avatar-menu{background:#1b1b1d;color:#f2f2f2;box-shadow:0 8px 30px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.08)}' +
      ".lp-avatar-email{padding:8px 12px 6px;font:400 12px/1.4 Inter,sans-serif;color:#8a8a8a;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}" +
      ".lp-avatar-item{display:block;width:100%;box-sizing:border-box;text-align:left;padding:8px 12px;border:0;background:none;" +
      "border-radius:10px;color:inherit;cursor:pointer;text-decoration:none;" +
      "font:500 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif}" +
      ".lp-avatar-item:hover{background:rgba(0,0,0,.06)}" +
      'html[data-theme="dark"] .lp-avatar-item:hover{background:rgba(255,255,255,.08)}';
    document.head.appendChild(s);
  }

  // ── Checkout / portal ──────────────────────────────────────────────────────
  function selectedBilling() {
    var billing = document.getElementById("pro-billing");
    return (billing && billing.getAttribute("data-billing")) || "monthly";
  }
  function teamSelected() {
    return !!document.querySelector('.pro-price-tab[data-plan="team"][data-active="true"]');
  }
  function setBusy(el, busy) {
    if (!el) return;
    if (busy) el.setAttribute("aria-busy", "true");
    else el.removeAttribute("aria-busy");
  }
  // ?code= on the pricing page (comp / press codes) wins over parity discount.
  function urlPromoCode() {
    try {
      var c = new URLSearchParams(location.search).get("code");
      return c ? c.trim().toUpperCase().slice(0, 40) : null;
    } catch (e) { return null; }
  }

  function startCheckout() {
    var billingKind = selectedBilling(); // monthly | annual | lifetime
    var payload;
    if (billingKind === "lifetime") {
      payload = { plan: teamSelected() ? "team-lifetime" : "lifetime" };
    } else if (teamSelected()) {
      payload = { plan: "team", interval: billingKind === "annual" ? "year" : "month" };
    } else {
      payload = { plan: billingKind === "annual" ? "yearly" : "monthly" };
    }
    var cta = document.getElementById("pro-price-cta");
    setBusy(cta, true);
    var promo = urlPromoCode();
    if (promo) payload.code = promo;
    apiJSON("/checkout", "POST", payload)
      .then(function (data) {
        if (data && data.url) location.href = data.url;
        else if (data && data.message) notify(data.message);
        else notify("Checkout is unavailable right now" + (data && data.error ? " (" + data.error + ")" : "") + ".");
      })
      .catch(function () { notify("Couldn't start checkout. Please try again."); })
      .finally(function () { setBusy(cta, false); });
  }

  function startPortal() {
    apiJSON("/portal", "POST").then(function (data) {
      if (data && data.url) location.href = data.url;
      else if (data && data.error === "no_billing_customer")
        notify("There's no billing history on this account.\nIf you bought Pro with a different email, sign out and sign in with that one.");
      else notify("Billing portal is unavailable right now." + (data && data.detail ? "\n(" + data.detail + ")" : ""));
    }).catch(function () { notify("Couldn't open the billing portal."); });
  }

  // ── Team API ───────────────────────────────────────────────────────────────
  var team = {
    get: function () { return apiJSON("/team"); },
    invite: function (email, role) { return apiJSON("/team/invite", "POST", { email: email, role: role }); },
    resend: function (id) { return apiJSON("/team/invite/resend", "POST", { id: id }); },
    cancel: function (id) { return apiJSON("/team/invite/cancel", "POST", { id: id }); },
    accept: function (token) { return apiJSON("/team/invite/accept", "POST", { token: token }); },
    previewInvite: function (token) { return apiJSON("/team/invite/preview?token=" + encodeURIComponent(token)); },
    remove: function (userId) { return apiJSON("/team/member/remove", "POST", { user_id: userId }); },
    role: function (userId, role) { return apiJSON("/team/member/role", "POST", { user_id: userId, role: role }); },
    transfer: function (userId) { return apiJSON("/team/transfer", "POST", { user_id: userId }); },
    seats: function (n) { return apiJSON("/team/seats", "POST", { seats: n }); },
    rename: function (name) { return apiJSON("/team/rename", "POST", { name: name }); },
  };

  // ── Auth primitives (code-only) ────────────────────────────────────────────
  // Request an emailed sign-in code. Optional deviceCode ties the login to a
  // device-activate flow; inviteToken makes signing in accept a team invite.
  function requestCode(email, deviceCode, inviteToken) {
    var body = { email: (email || "").trim() };
    if (deviceCode) body.device_code = deviceCode;
    if (inviteToken) body.invite_token = inviteToken;
    return apiJSON("/auth/code/request", "POST", body);
  }
  // Exchange email + typed code for a session in THIS browser.
  function submitCode(email, code) {
    return apiJSON("/auth/code", "POST", { email: (email || "").trim(), code: (code || "").trim() });
  }
  function approveDevice(userCode) {
    return apiJSON("/device/approve", "POST", { user_code: (userCode || "").trim().toUpperCase() });
  }
  // After checkout: resolve the buyer's email from the Stripe session and email a code.
  function signInFromCheckout(sessionId) {
    return apiJSON("/auth/from-checkout", "POST", { session_id: sessionId });
  }

  function signIn() { openAuthModal(); }
  function notify(msg) { window.alert(msg); }

  // Fetch a premium component source (markdown) from the API.
  function fetchProContent(id, variant) {
    return api("/content/" + encodeURIComponent(id) + "/" + encodeURIComponent(variant || "css"))
      .then(function (r) {
        if (!r.ok) { var e = new Error("content " + r.status); e.status = r.status; throw e; }
        return r.text();
      });
  }

  // ── Sign-in modal (two steps: email → code) ────────────────────────────────
  var modalEl = null, lastFocus = null;

  function ensureAuthModal() {
    if (modalEl) return modalEl;
    injectModalStyle();
    modalEl = document.createElement("div");
    modalEl.className = "lp-modal";
    modalEl.setAttribute("hidden", "");
    // Two steps, one question each: ask for the email, then ask for the code.
    // Both forms on screen together presented two inputs and two buttons at
    // once and left the user deciding which they were meant to use.
    modalEl.innerHTML =
      '<div class="lp-modal-backdrop" data-lp-close></div>' +
      '<div class="lp-modal-card" role="dialog" aria-modal="true" aria-labelledby="lp-modal-title">' +
        '<button type="button" class="lp-modal-x" aria-label="Close" data-lp-close>&times;</button>' +
        '<p class="lp-modal-intro" id="lp-modal-title">Enter your email address' +
          '<span class="lp-modal-intro-muted" data-step-sub>The one you used at checkout.</span></p>' +
        '<form class="lp-modal-form lp-modal-email-form" novalidate>' +
          '<div class="lp-modal-field">' +
            '<input class="lp-modal-input" id="lp-modal-email" type="email" name="email" placeholder="you@example.com" autocomplete="email" aria-label="Email address" />' +
            '<p class="lp-modal-error" role="alert" hidden>Please enter a valid email.</p>' +
          '</div>' +
          '<button class="lp-modal-btn" type="submit">Send code</button>' +
          '<button class="lp-modal-btn lp-modal-btn--ghost" type="button" data-lp-close>Back</button>' +
        '</form>' +
        '<form class="lp-modal-form lp-modal-code-form" novalidate hidden>' +
          '<div class="lp-modal-field">' +
            '<input class="lp-modal-input" id="lp-modal-code" type="text" name="code" placeholder="XXXX-XXXX" autocomplete="one-time-code" spellcheck="false" inputmode="text" style="text-transform:uppercase" aria-label="One-time code" />' +
            '<p class="lp-modal-error" role="alert" hidden>That code didn’t work — check it and try again.</p>' +
          '</div>' +
          '<button class="lp-modal-btn" type="submit">Verify</button>' +
          '<button class="lp-modal-btn lp-modal-btn--ghost" type="button" data-lp-restart>Use a different email</button>' +
        '</form>' +
        '<p class="lp-modal-note" role="status" hidden></p>' +
        '<p class="lp-modal-foot">No access? <a href="pro.html">Get Pro</a></p>' +
      "</div>";
    document.body.appendChild(modalEl);

    modalEl.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-lp-close")) closeAuthModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modalEl.hasAttribute("hidden")) closeAuthModal();
    });

    // Step control. The card shows exactly one form at a time; the heading and
    // sub-line change with it so the user is answering one question per screen.
    var emailForm = modalEl.querySelector(".lp-modal-email-form");
    var codeFormEl = modalEl.querySelector(".lp-modal-code-form");
    var titleEl = modalEl.querySelector(".lp-modal-intro");
    function showStep(step, email) {
      var code = step === "code";
      emailForm.hidden = code;
      codeFormEl.hidden = !code;
      titleEl.firstChild.nodeValue = code ? "Enter one-time password" : "Enter your email address";
      var sub = titleEl.querySelector("[data-step-sub]");
      if (sub) sub.textContent = code
        ? "We sent it to " + (email || "your inbox") + "."
        : "The one you used at checkout.";
      var focusEl = modalEl.querySelector(code ? "#lp-modal-code" : "#lp-modal-email");
      setTimeout(function () { if (focusEl) focusEl.focus(); }, 0);
    }
    modalEl.__showStep = showStep;

    // "Use a different email" returns to step one rather than closing, so a
    // typo in the address costs one click instead of restarting the flow.
    var restart = modalEl.querySelector("[data-lp-restart]");
    if (restart) {
      restart.addEventListener("click", function () {
        var note = modalEl.querySelector(".lp-modal-note");
        setModalNote(note, "", "");
        codeFormEl.querySelector(".lp-modal-error").hidden = true;
        codeFormEl.querySelector(".lp-modal-input").value = "";
        showStep("email");
      });
    }

    var input = emailForm.querySelector(".lp-modal-input");
    var errEl = emailForm.querySelector(".lp-modal-error");
    function setError(on) {
      input.classList.toggle("is-error", on);
      errEl.hidden = !on;
      if (on) {
        input.classList.remove("is-shaking");
        void input.offsetWidth;
        input.classList.add("is-shaking");
        setTimeout(function () { input.classList.remove("is-shaking"); }, 300);
      }
    }
    input.addEventListener("input", function () { setError(false); });

    emailForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = emailForm.querySelector(".lp-modal-btn");
      var note = modalEl.querySelector(".lp-modal-note");
      var email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError(true); input.focus(); return; }
      setError(false);
      btn.disabled = true; btn.textContent = "Sending…";
      requestCode(email, modalEl._deviceCode, modalEl._inviteToken)
        .then(function (data) {
          // apiJSON resolves on any status, so a refusal arrives here.
          if (data && data.error === "no_plan") {
            setModalNote(note,
              "No Libraries.dev plan is attached to that email.\n" +
              "Bought Pro with a different address? Try that one — otherwise pick a plan to get started.",
              "err");
            return;
          }
          // The step itself already says an email was sent and to which address;
          // a second confirmation line only competes with it.
          setModalNote(note, "", "");
          if (modalEl.__showStep) modalEl.__showStep("code", email);
        })
        .catch(function () { setModalNote(note, "Couldn’t send the code. Please try again.", "err"); })
        .finally(function () { btn.disabled = false; btn.textContent = "Send code"; });
    });

    var codeForm = codeFormEl;
    codeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var cInput = codeForm.querySelector("input");
      var cErr = codeForm.querySelector(".lp-modal-error");
      var cBtn = codeForm.querySelector(".lp-modal-btn");
      var note = modalEl.querySelector(".lp-modal-note");
      var code = cInput.value.trim();
      if (!code) { cErr.hidden = false; cInput.focus(); return; }
      cErr.hidden = true;
      cBtn.disabled = true; cBtn.textContent = "Verifying…";
      submitCode(input.value.trim(), code)
        .then(function (r) {
          if (r && r.ok) {
            setModalNote(note, "Signed in.", "ok");
            return refreshMe().then(function () {
              closeAuthModal();
              // Device flow approved/denied server-side by the same code.
              if (r.next === "device_approved" || r.next === "device_denied") {
                document.dispatchEvent(new CustomEvent("pro:device", { detail: r.next }));
              }
            });
          }
          cErr.textContent = r && r.error === "too_many_attempts"
            ? "Too many tries — request a fresh code."
            : "That code didn’t work — check it and try again.";
          cErr.hidden = false;
          cInput.classList.remove("is-shaking"); void cInput.offsetWidth; cInput.classList.add("is-shaking");
          setTimeout(function () { cInput.classList.remove("is-shaking"); }, 300);
        })
        .catch(function () { cErr.hidden = false; })
        .finally(function () { cBtn.disabled = false; cBtn.textContent = "Verify"; });
    });
    return modalEl;
  }

  function setModalNote(note, msg, kind) {
    note.textContent = msg; note.hidden = !msg;
    note.setAttribute("data-kind", kind || "");
  }

  // opts: { deviceCode, inviteToken } — carried into the code request.
  function openAuthModal(opts) {
    var m = ensureAuthModal();
    m._deviceCode = opts && opts.deviceCode || null;
    m._inviteToken = opts && opts.inviteToken || null;
    lastFocus = document.activeElement;
    setModalNote(m.querySelector(".lp-modal-note"), "", "");
    if (m.__showStep) m.__showStep("email");
    m.classList.remove("is-closing");
    m.removeAttribute("hidden");
    void m.offsetWidth;
    m.classList.add("is-open");
    var input = m.querySelector(".lp-modal-input");
    setTimeout(function () { input.focus(); }, 0);
  }
  window.LibrariesPro.openSignIn = openAuthModal;

  function closeAuthModal() {
    if (!modalEl || modalEl.hasAttribute("hidden")) return;
    modalEl.classList.remove("is-open");
    modalEl.classList.add("is-closing");
    setTimeout(function () {
      modalEl.classList.remove("is-closing");
      modalEl.setAttribute("hidden", "");
    }, 150);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function injectModalStyle() {
    if (document.getElementById("lp-modal-base")) return;
    var s = document.createElement("style");
    s.id = "lp-modal-base";
    s.textContent =
      ".lp-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
      "font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}" +
      ".lp-modal[hidden]{display:none}" +
      ".lp-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;" +
      "transition:opacity 250ms cubic-bezier(0.22,1,0.36,1)}" +
      ".lp-modal-card{position:relative;width:min(92vw,369px);box-sizing:border-box;background:#fff;color:#0d0d0d;" +
      "border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:24px;" +
      "box-shadow:0 1px 3px rgba(0,0,0,.04)," +
      "inset 0 0 0 1px rgba(0,0,0,.06),inset 0 -1px 0 0 rgba(0,0,0,.06),inset 0 0 0 1px rgba(196,196,196,.1);" +
      "opacity:0;transform:scale(.96);transform-origin:center;will-change:transform,opacity;" +
      "transition:transform 250ms cubic-bezier(0.22,1,0.36,1),opacity 250ms cubic-bezier(0.22,1,0.36,1)}" +
      ".lp-modal.is-open .lp-modal-backdrop{opacity:1}" +
      ".lp-modal.is-open .lp-modal-card{opacity:1;transform:scale(1)}" +
      ".lp-modal.is-closing .lp-modal-backdrop{opacity:0;transition:opacity 150ms cubic-bezier(0.22,1,0.36,1)}" +
      ".lp-modal.is-closing .lp-modal-card{opacity:0;transform:scale(.96);" +
      "transition:transform 150ms cubic-bezier(0.22,1,0.36,1),opacity 150ms cubic-bezier(0.22,1,0.36,1)}" +
      'html[data-theme="dark"] .lp-modal-card{background:#1b1b1d;color:#f2f2f2}' +
      ".lp-modal-x{position:absolute;top:14px;right:16px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:inherit;opacity:.55;padding:2px;" +
      "transition:opacity 120ms ease,scale 120ms cubic-bezier(0.22,1,0.36,1)}" +
      ".lp-modal-x:hover{opacity:.9}" +
      ".lp-modal-x:active{scale:.9}" +
      ".lp-modal-intro{margin:0;font-size:16px;line-height:24.2px;font-weight:400;padding-right:20px}" +
      ".lp-modal-intro-muted{color:#8a8a8a;display:block}" +
      ".lp-modal-form{display:flex;flex-direction:column;gap:12px}" +
      // An author display rule outranks the UA [hidden] style, so every element
      // this modal toggles needs its own companion rule (site.css's global
      // [hidden] covers pages, but the modal must stand alone).
      ".lp-modal-form[hidden],.lp-modal-note[hidden],.lp-modal-error[hidden]{display:none}" +
      ".lp-modal-field{display:flex;flex-direction:column;gap:6px}" +
      ".lp-modal-label{font-size:13px;line-height:1.4;color:#4d4d4d}" +
      'html[data-theme="dark"] .lp-modal-label{color:#b5b5b5}' +
      ".lp-modal-input{width:100%;box-sizing:border-box;height:40px;padding:4px 4px 4px 12px;" +
      "font-family:inherit;font-size:13px;line-height:1.4;color:#0f0f0f;" +
      "background:#fff;border:1px solid #dcdcdc;border-radius:60px;outline:none;" +
      "will-change:transform;transition:border-color 120ms ease}" +
      ".lp-modal-input::placeholder{color:#828282}" +
      ".lp-modal-input:focus{border:1.5px solid #585858;padding-left:11.5px}" +
      ".lp-modal-input.is-error,.lp-modal-input.is-error:focus{border:1.5px solid #e23014;padding-left:11.5px}" +
      'html[data-theme="dark"] .lp-modal-input{background:#151517;color:#f2f2f2;border-color:#3a3a3d}' +
      'html[data-theme="dark"] .lp-modal-input:focus{border-color:#a5a5a5}' +
      'html[data-theme="dark"] .lp-modal-input.is-error{border-color:#e23014}' +
      ".lp-modal-error{margin:-2px 0 0;font-size:13px;line-height:1.4;color:#d62b11}" +
      ".lp-modal-btn{width:100%;height:40px;border:0;border-radius:26px;background:#17181c;color:#fff;" +
      "font-family:inherit;font-size:13px;line-height:13px;font-weight:500;cursor:pointer;" +
      "box-shadow:0 1px 2px rgba(0,0,0,.2);transition:scale 120ms cubic-bezier(0.22,1,0.36,1),opacity 120ms ease}" +
      ".lp-modal-btn:not([disabled]):active{scale:.96}" +
      ".lp-modal-btn[disabled]{opacity:.6;cursor:default}" +
      'html[data-theme="dark"] .lp-modal-btn{background:#f2f2f2;color:#111}' +
      // Site secondary tokens, matching the paywall's secondary action: the
      // 0 1px 2px shadow belongs to the PRIMARY variant only, so the secondary
      // drops it rather than inheriting it from the base class. Doubled class
      // so this outranks the themed base rule whatever the sheet order.
      ".lp-modal-btn.lp-modal-btn--ghost{background:#e9e9e9;color:#17181c;box-shadow:none}" +
      ".lp-modal-btn.lp-modal-btn--ghost:hover{background:#e0e0e0}" +
      'html[data-theme="dark"] .lp-modal-btn.lp-modal-btn--ghost{background:#2a2a2c;color:#f2f2f2}' +
      'html[data-theme="dark"] .lp-modal-btn.lp-modal-btn--ghost:hover{background:#333336}' +
      ".lp-modal-note{margin:0;font-size:13px;line-height:1.4;white-space:pre-line}" +
      '.lp-modal-note[data-kind="ok"]{color:#16a34a}' +
      '.lp-modal-note[data-kind="err"]{color:#d62b11}' +
      ".lp-modal-foot{margin:0;font-size:13px;line-height:16px;color:#17181c}" +
      ".lp-modal-foot a{color:inherit;font-weight:500;text-decoration:none}" +
      ".lp-modal-foot a:hover{text-decoration:underline}" +
      'html[data-theme="dark"] .lp-modal-foot{color:#e5e5e5}' +
      ".lp-modal-input.is-shaking{animation:lp-shake 280ms linear}" +
      "@keyframes lp-shake{" +
      "0%{transform:translateX(0);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}" +
      "28.57%{transform:translateX(6px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}" +
      "57.14%{transform:translateX(-6px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}" +
      "78.57%{transform:translateX(4px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}" +
      "100%{transform:translateX(0)}}" +
      "@media (prefers-reduced-motion:reduce){" +
      ".lp-modal-card,.lp-modal-backdrop,.lp-modal-btn,.lp-modal-x{transition:none!important}" +
      ".lp-modal-input{animation:none!important;transform:none!important}}";
    document.head.appendChild(s);
  }

  function wire() {
    var cta = document.getElementById("pro-price-cta");
    if (cta) {
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        if (cta.getAttribute("data-action") === "portal") startPortal();
        else startCheckout();
      });
    }
    // Footer "Sign in" link (optional on any page).
    var footerSignin = document.getElementById("footer-signin");
    if (footerSignin) {
      footerSignin.addEventListener("click", function (e) {
        e.preventDefault();
        if (state.authenticated) location.href = "account.html";
        else signIn();
      });
    }
    // Paint the cached (optimistic) auth state first so the nav doesn't flash
    // the signed-out pills before /me answers. `resolved` stays false.
    var cached = readAuthCache();
    if (cached) {
      state.authenticated = !!cached.a;
      state.pro = !!cached.p;
      state.email = cached.e || null;
      document.dispatchEvent(new CustomEvent("pro:me", { detail: state }));
    }
    paintAuth();
    refreshMe();
    refreshGeo();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
})();
