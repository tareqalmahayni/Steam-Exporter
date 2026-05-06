/**
 * Bookmarklet payload script.
 *
 * Inlined by the React install page into a `javascript:` URL so it bypasses
 * Steamworks' Content Security Policy (which would block a remote
 * `<script src="…">` tag). `__SERVER_ORIGIN__` is templated server-side.
 *
 * Two clicks total:
 *
 * 1) Click on partner.steamgames.com — auto-collects /home + traffic pages,
 *    submits to server, prompts user to switch to partner.steampowered.com.
 *
 * 2) Click on partner.steampowered.com — runs a 3-step in-page wizard:
 *      Step 1: Pick games (with Total Wishlists shown per game).
 *      Step 2: Pick date range (Daily / Weekly / Monthly / Yearly / Lifetime
 *              or a custom Start–End range up to today).
 *      Step 3: Pull data — fetches sales for selected games + dates,
 *              submits, auto-downloads Excel.
 */
export const bookmarkletScript = String.raw`
(function() {
  if (window.__SWEXP_LOADED__) {
    if (typeof window.__SWEXP_RUN__ === "function") window.__SWEXP_RUN__();
    return;
  }
  window.__SWEXP_LOADED__ = true;

  var SERVER = "__SERVER_ORIGIN__";
  var host = location.hostname;

  // ── Overlay shell ────────────────────────────────────────────
  var overlay = document.createElement("div");
  overlay.id = "swexp-overlay";
  overlay.style.cssText = [
    "position:fixed","top:20px","right:20px","width:460px","max-height:88vh","overflow:auto",
    "background:#1b2838","color:#c7d5e0",
    "border:1px solid #66c0f4","border-radius:10px","padding:0",
    "font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    "z-index:2147483647","box-shadow:0 12px 48px rgba(0,0,0,0.7)"
  ].join(";");
  overlay.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #2a475e;">' +
      '<div style="font-size:15px;font-weight:600;color:#66c0f4;letter-spacing:0.2px;">Steamworks Exporter</div>' +
      '<button id="swexp-close" style="background:none;border:none;color:#8f98a0;cursor:pointer;font-size:22px;line-height:1;padding:0 4px;">&times;</button>' +
    '</div>' +
    '<div id="swexp-stepper" style="display:none;padding:10px 18px 0;"></div>' +
    '<div id="swexp-body" style="padding:16px 18px 18px;">Initializing&hellip;</div>';
  document.body.appendChild(overlay);
  document.getElementById("swexp-close").onclick = function() {
    overlay.remove();
    window.__SWEXP_LOADED__ = false;
  };

  // ── Helpers ──────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function setBody(html) { $("swexp-body").innerHTML = html; }
  function setBodyText(s) { $("swexp-body").textContent = s; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }
  function err(msg) {
    setBody('<div style="color:#ff6b6b;font-weight:500;">\u274C ' + esc(msg) + '</div>');
  }
  function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
  function fmtNum(n) { return n == null ? "\u2014" : n.toLocaleString(); }

  function setStepper(active) {
    var s = $("swexp-stepper");
    if (active === 0) { s.style.display = "none"; return; }
    s.style.display = "flex";
    var labels = ["Pick games", "Date range", "Pull"];
    s.style.cssText = "display:flex;padding:12px 18px 6px;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;";
    s.innerHTML = labels.map(function(label, i) {
      var n = i + 1;
      var on = active === n;
      var done = active > n;
      var color = on ? "#66c0f4" : done ? "#5dd3a8" : "#525c66";
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:' + (on || done ? color : "#2a475e") + ';color:' + (on || done ? "#0a1419" : "#8f98a0") + ';font-weight:700;font-size:11px;">' + (done ? "\u2713" : n) + '</span>' +
          '<span style="color:' + color + ';font-weight:600;">' + label + '</span>' +
        '</div>' +
        '<div style="height:2px;width:100%;background:' + (done ? "#5dd3a8" : on ? "#66c0f4" : "#2a475e") + ';"></div>' +
      '</div>';
    }).join("");
  }

  async function fetchHtml(url) {
    var r = await fetch(url, { credentials: "include", headers: { "Accept": "text/html" } });
    return await r.text();
  }
  async function postJson(path, body) {
    var r = await fetch(SERVER + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      var t = await r.text();
      throw new Error(path + " \u2192 HTTP " + r.status + " " + t.slice(0, 200));
    }
    return await r.json();
  }
  async function pullPages(urls, onProgress) {
    var htmlByUrl = {};
    for (var i = 0; i < urls.length; i++) {
      onProgress(i, urls.length);
      try { htmlByUrl[urls[i]] = await fetchHtml(urls[i]); } catch (_) {}
      await sleep(350);
    }
    return htmlByUrl;
  }

  /**
   * Best-effort wishlist total parser (client-side regex).
   * Steam's wishlist page contains a JS data block and rendered HTML;
   * we try several patterns. Server-side parser remains the source of
   * truth for the Excel — this number is just for the picker UI.
   */
  function parseWishlistTotal(html) {
    if (!html) return null;
    var patterns = [
      /Lifetime\s+(?:Wishlists?|Wishlist Adds?)[\s\S]{0,400}?(\d{1,3}(?:,\d{3})+|\d{2,})/i,
      /Total\s+(?:Wishlists?|Wishlist Adds?)[\s\S]{0,400}?(\d{1,3}(?:,\d{3})+|\d{2,})/i,
      /WishlistsCurrent[^"']*['"\s:]+(\d+)/i,
      /"current_wishlists"\s*:\s*(\d+)/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = html.match(patterns[i]);
      if (m) {
        var n = parseInt(m[1].replace(/,/g, ""), 10);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // CLICK 1: partner.steamgames.com — collect game list + traffic
  // ─────────────────────────────────────────────────────────────
  async function runSteamgames() {
    setStepper(0);
    setBodyText("Reading your Steamworks home page\u2026");
    var homeHtml;
    try { homeHtml = await fetchHtml("/home"); }
    catch (_e) { err("Could not load /home. Are you logged in to Steamworks?"); return; }

    setBodyText("Detecting your games on the server\u2026");
    var init = await postJson("/api/browser-pull/init", { homeHtml: homeHtml, granularity: "monthly" });
    if (!init.games || init.games.length === 0) { err("No games detected on /home."); return; }

    setBody(
      '<div>Found <strong style="color:#66c0f4;">' + init.gameCount + '</strong> game(s).</div>' +
      '<div id="swexp-tprog" style="margin-top:6px;font-size:13px;color:#8f98a0;">Collecting traffic data\u2026</div>'
    );
    var tHtml = await pullPages(init.steamgamesUrls, function(i, n) {
      $("swexp-tprog").textContent = "Traffic page " + (i + 1) + " of " + n + "\u2026";
    });

    setBodyText("Saving traffic data\u2026");
    await postJson("/api/browser-pull/submit", {
      sessionId: init.sessionId, domain: "steamgames", htmlByUrl: tHtml
    });

    setBody(
      '<div style="display:flex;align-items:center;gap:10px;color:#5dd3a8;font-weight:600;font-size:15px;margin-bottom:8px;">' +
        '<span>\u2705</span><span>Step 1 of 2 complete</span>' +
      '</div>' +
      '<div style="font-size:13px;color:#8f98a0;margin-bottom:14px;">' +
        init.gameCount + ' game(s) detected. ' + Object.keys(tHtml).length + ' traffic page(s) collected.' +
      '</div>' +
      '<div style="background:#2a475e;border-radius:6px;padding:14px;font-size:13px;line-height:1.6;">' +
        '<div style="font-weight:600;color:#66c0f4;margin-bottom:6px;">Next: open partner.steampowered.com</div>' +
        'Open <a href="https://partner.steampowered.com/" target="_blank" style="color:#66c0f4;font-weight:600;">partner.steampowered.com</a> in a new tab and click your <em>Steamworks Exporter</em> bookmark there. ' +
        'You\'ll get to pick which games to export and what date range to use.' +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CLICK 2: partner.steampowered.com — wizard
  // ─────────────────────────────────────────────────────────────
  var SESSION = null;
  var GAMES = []; // { appId, name, wishlistTotal }
  var SELECTED_IDS = new Set();
  var GRANULARITY = "monthly";
  var CUSTOM_START = "";
  var CUSTOM_END = "";

  async function runSteampowered() {
    setStepper(1);
    setBodyText("Looking up your active export\u2026");
    var ar;
    try { ar = await fetch(SERVER + "/api/browser-pull/active"); }
    catch (_e) { err("Could not reach the export server."); return; }
    if (!ar.ok) {
      err("No active export. Click the bookmark on partner.steamgames.com first.");
      return;
    }
    var active = await ar.json();
    SESSION = active.sessionId;
    GAMES = active.games.map(function(g){ return { appId: g.appId, name: g.name, wishlistTotal: null }; });
    GAMES.forEach(function(g){ SELECTED_IDS.add(g.appId); });

    setBody(
      '<div>Loading wishlist totals for <strong style="color:#66c0f4;">' + GAMES.length + '</strong> game(s)\u2026</div>' +
      '<div id="swexp-wprog" style="margin-top:6px;font-size:13px;color:#8f98a0;"></div>'
    );

    var wishlistHtmlByUrl = {};
    for (var i = 0; i < active.wishlistUrls.length; i++) {
      $("swexp-wprog").textContent = "Wishlist page " + (i + 1) + " of " + active.wishlistUrls.length + "\u2026";
      var url = active.wishlistUrls[i];
      var html = "";
      try { html = await fetchHtml(url); } catch (_) {}
      wishlistHtmlByUrl[url] = html;
      // appId is the last numeric segment of the URL
      var idMatch = url.match(/\/wishlist\/(\d+)\//);
      if (idMatch) {
        var appId = parseInt(idMatch[1], 10);
        var total = parseWishlistTotal(html);
        var g = GAMES.find(function(x){ return x.appId === appId; });
        if (g) g.wishlistTotal = total;
      }
      await sleep(300);
    }

    // Stash wishlist HTML on the window so step 3 can submit it later.
    window.__SWEXP_WISHLIST_HTML__ = wishlistHtmlByUrl;

    renderStep1();
  }

  // ── Step 1: pick games ───────────────────────────────────────
  function renderStep1() {
    setStepper(1);
    var sorted = GAMES.slice().sort(function(a, b) {
      return (b.wishlistTotal || 0) - (a.wishlistTotal || 0);
    });
    var rows = sorted.map(function(g) {
      var checked = SELECTED_IDS.has(g.appId) ? "checked" : "";
      var total = g.wishlistTotal == null
        ? '<span style="color:#525c66;">\u2014</span>'
        : '<span style="color:#5dd3a8;font-variant-numeric:tabular-nums;">' + fmtNum(g.wishlistTotal) + '</span>';
      return '<label style="display:flex;align-items:center;padding:6px 8px;gap:10px;border-radius:4px;cursor:pointer;" onmouseover="this.style.background=\'#2a475e\'" onmouseout="this.style.background=\'transparent\'">' +
        '<input type="checkbox" class="swexp-game" data-id="' + g.appId + '" ' + checked + ' style="cursor:pointer;">' +
        '<span style="flex:1;font-size:13px;">' + esc(g.name) + '</span>' +
        '<span style="font-size:12px;min-width:80px;text-align:right;">' + total + '</span>' +
        '<span style="color:#525c66;font-size:11px;font-variant-numeric:tabular-nums;">' + g.appId + '</span>' +
      '</label>';
    }).join("");

    setBody(
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">' +
        '<div style="font-weight:600;">Choose games to export</div>' +
        '<div id="swexp-count" style="font-size:12px;color:#8f98a0;"></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;font-size:12px;margin-bottom:8px;">' +
        '<button id="swexp-all"  style="background:#2a475e;color:#c7d5e0;border:1px solid #3d5a73;border-radius:3px;padding:4px 10px;cursor:pointer;">All</button>' +
        '<button id="swexp-none" style="background:#2a475e;color:#c7d5e0;border:1px solid #3d5a73;border-radius:3px;padding:4px 10px;cursor:pointer;">None</button>' +
        '<div style="flex:1;"></div>' +
        '<div style="font-size:11px;color:#525c66;align-self:center;">Sorted by total wishlists</div>' +
      '</div>' +
      '<div style="max-height:280px;overflow:auto;border:1px solid #2a475e;border-radius:6px;background:#0e1822;padding:4px;margin-bottom:14px;">' + rows + '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
        '<button id="swexp-next1" style="background:#66c0f4;color:#0a1419;border:none;border-radius:4px;padding:9px 18px;font-weight:600;cursor:pointer;font-size:13px;">Next: date range \u2192</button>' +
      '</div>'
    );

    function updateCount() {
      var n = document.querySelectorAll(".swexp-game:checked").length;
      $("swexp-count").textContent = n + " of " + GAMES.length + " selected";
      $("swexp-next1").disabled = n === 0;
      $("swexp-next1").style.opacity = n === 0 ? "0.5" : "1";
      $("swexp-next1").style.cursor = n === 0 ? "not-allowed" : "pointer";
    }
    document.querySelectorAll(".swexp-game").forEach(function(c) {
      c.addEventListener("change", function() {
        var id = parseInt(c.getAttribute("data-id"), 10);
        if (c.checked) SELECTED_IDS.add(id); else SELECTED_IDS.delete(id);
        updateCount();
      });
    });
    $("swexp-all").onclick = function() {
      document.querySelectorAll(".swexp-game").forEach(function(c){
        c.checked = true; SELECTED_IDS.add(parseInt(c.getAttribute("data-id"), 10));
      });
      updateCount();
    };
    $("swexp-none").onclick = function() {
      document.querySelectorAll(".swexp-game").forEach(function(c){
        c.checked = false; SELECTED_IDS.delete(parseInt(c.getAttribute("data-id"), 10));
      });
      updateCount();
    };
    $("swexp-next1").onclick = function() {
      if (SELECTED_IDS.size === 0) return;
      renderStep2();
    };
    updateCount();
  }

  // ── Step 2: date range ───────────────────────────────────────
  function renderStep2() {
    setStepper(2);
    var todayIso = new Date().toISOString().slice(0, 10);
    if (!CUSTOM_END) CUSTOM_END = todayIso;
    if (!CUSTOM_START) {
      var d = new Date();
      d.setDate(d.getDate() - 30);
      CUSTOM_START = d.toISOString().slice(0, 10);
    }

    var presets = [
      { v: "daily",    label: "Daily",    sub: "Last 1 day" },
      { v: "weekly",   label: "Weekly",   sub: "Last 7 days" },
      { v: "monthly",  label: "Monthly",  sub: "Last 30 days" },
      { v: "yearly",   label: "Yearly",   sub: "Last 365 days" },
      { v: "lifetime", label: "Lifetime", sub: "All time" }
    ];

    setBody(
      '<div style="font-weight:600;margin-bottom:10px;">Pick a date range</div>' +
      '<div id="swexp-presets" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">' +
        presets.map(function(p) {
          var on = GRANULARITY === p.v;
          return '<button data-v="' + p.v + '" class="swexp-preset" style="text-align:left;padding:9px 12px;border-radius:5px;cursor:pointer;border:1px solid ' + (on ? "#66c0f4" : "#2a475e") + ';background:' + (on ? "#2a4a63" : "#1b2838") + ';color:#c7d5e0;">' +
            '<div style="font-weight:600;font-size:13px;color:' + (on ? "#66c0f4" : "#c7d5e0") + ';">' + p.label + '</div>' +
            '<div style="font-size:11px;color:#8f98a0;margin-top:2px;">' + p.sub + '</div>' +
          '</button>';
        }).join("") +
      '</div>' +
      '<div style="border-top:1px solid #2a475e;padding-top:12px;margin-bottom:14px;">' +
        '<button id="swexp-customBtn" class="swexp-preset" data-v="custom" style="display:block;width:100%;text-align:left;padding:9px 12px;border-radius:5px;cursor:pointer;border:1px solid ' + (GRANULARITY === "custom" ? "#66c0f4" : "#2a475e") + ';background:' + (GRANULARITY === "custom" ? "#2a4a63" : "#1b2838") + ';color:#c7d5e0;margin-bottom:10px;">' +
          '<div style="font-weight:600;font-size:13px;color:' + (GRANULARITY === "custom" ? "#66c0f4" : "#c7d5e0") + ';">Custom range</div>' +
          '<div style="font-size:11px;color:#8f98a0;margin-top:2px;">Pick exact start and end dates</div>' +
        '</button>' +
        '<div id="swexp-customFields" style="display:' + (GRANULARITY === "custom" ? "grid" : "none") + ';grid-template-columns:1fr 1fr;gap:8px;">' +
          '<label style="font-size:12px;color:#8f98a0;">Start' +
            '<input id="swexp-startDate" type="date" max="' + todayIso + '" value="' + CUSTOM_START + '" style="display:block;margin-top:3px;width:100%;background:#2a475e;color:#c7d5e0;border:1px solid #3d5a73;border-radius:3px;padding:6px;font-size:13px;">' +
          '</label>' +
          '<label style="font-size:12px;color:#8f98a0;">End' +
            '<input id="swexp-endDate" type="date" max="' + todayIso + '" value="' + CUSTOM_END + '" style="display:block;margin-top:3px;width:100%;background:#2a475e;color:#c7d5e0;border:1px solid #3d5a73;border-radius:3px;padding:6px;font-size:13px;">' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;">' +
        '<button id="swexp-back2" style="background:transparent;color:#8f98a0;border:1px solid #2a475e;border-radius:4px;padding:9px 14px;cursor:pointer;font-size:13px;">\u2190 Back</button>' +
        '<button id="swexp-next2" style="background:#66c0f4;color:#0a1419;border:none;border-radius:4px;padding:9px 18px;font-weight:600;cursor:pointer;font-size:13px;">Next: pull data \u2192</button>' +
      '</div>'
    );

    document.querySelectorAll(".swexp-preset").forEach(function(b) {
      b.onclick = function() {
        GRANULARITY = b.getAttribute("data-v");
        renderStep2();
      };
    });
    if ($("swexp-startDate")) $("swexp-startDate").onchange = function(){ CUSTOM_START = $("swexp-startDate").value; };
    if ($("swexp-endDate"))   $("swexp-endDate").onchange   = function(){ CUSTOM_END   = $("swexp-endDate").value; };
    $("swexp-back2").onclick = function() { renderStep1(); };
    $("swexp-next2").onclick = function() {
      if (GRANULARITY === "custom") {
        if (!CUSTOM_START || !CUSTOM_END) { alert("Pick both start and end dates."); return; }
        if (CUSTOM_START > CUSTOM_END) { alert("Start date must be on or before end date."); return; }
      }
      renderStep3();
    };
  }

  // ── Step 3: pull + download ──────────────────────────────────
  async function renderStep3() {
    setStepper(3);
    var rangeLabel = GRANULARITY === "custom"
      ? CUSTOM_START + " \u2192 " + CUSTOM_END
      : GRANULARITY.charAt(0).toUpperCase() + GRANULARITY.slice(1);

    setBody(
      '<div style="font-weight:600;margin-bottom:6px;">Ready to pull</div>' +
      '<div style="background:#0e1822;border:1px solid #2a475e;border-radius:6px;padding:12px;font-size:13px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#8f98a0;">Games</span><span><strong>' + SELECTED_IDS.size + '</strong> selected</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#8f98a0;">Date range</span><span><strong>' + esc(rangeLabel) + '</strong></span></div>' +
      '</div>' +
      '<div id="swexp-pullProg" style="font-size:13px;color:#8f98a0;margin-bottom:12px;min-height:1em;"></div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;">' +
        '<button id="swexp-back3" style="background:transparent;color:#8f98a0;border:1px solid #2a475e;border-radius:4px;padding:9px 14px;cursor:pointer;font-size:13px;">\u2190 Back</button>' +
        '<button id="swexp-pull" style="background:#5dd3a8;color:#0a1419;border:none;border-radius:4px;padding:9px 22px;font-weight:700;cursor:pointer;font-size:13px;">\u25B6 Pull data</button>' +
      '</div>'
    );
    $("swexp-back3").onclick = function() { renderStep2(); };
    $("swexp-pull").onclick = function() {
      $("swexp-pull").disabled = true;
      $("swexp-pull").style.opacity = "0.5";
      $("swexp-back3").disabled = true;
      doPull().catch(function(e){ err((e && e.message) || String(e)); });
    };
  }

  async function doPull() {
    var setProg = function(s) { $("swexp-pullProg").textContent = s; };
    setProg("Configuring pull on server\u2026");
    var cfg = await postJson("/api/browser-pull/configure", {
      sessionId: SESSION,
      selectedAppIds: Array.from(SELECTED_IDS),
      granularity: GRANULARITY,
      customStartIso: GRANULARITY === "custom" ? CUSTOM_START : undefined,
      customEndIso:   GRANULARITY === "custom" ? CUSTOM_END   : undefined
    });

    var salesHtml = await pullPages(cfg.salesUrls, function(i, n) {
      setProg("Fetching sales page " + (i + 1) + " of " + n + "\u2026");
    });

    setProg("Submitting & generating Excel\u2026");
    // Combine wishlist HTML (already collected) + sales HTML.
    var combined = Object.assign({}, window.__SWEXP_WISHLIST_HTML__ || {}, salesHtml);
    var result = await postJson("/api/browser-pull/submit", {
      sessionId: SESSION, domain: "steampowered", htmlByUrl: combined
    });

    if (result.downloadUrl) {
      var url = SERVER + result.downloadUrl;
      setStepper(0);
      setBody(
        '<div style="display:flex;align-items:center;gap:10px;color:#5dd3a8;font-weight:600;font-size:16px;margin-bottom:10px;">' +
          '<span>\u2705</span><span>Export complete!</span>' +
        '</div>' +
        '<div style="font-size:13px;color:#8f98a0;margin-bottom:14px;">' +
          SELECTED_IDS.size + ' game(s), range: ' + esc(GRANULARITY === "custom" ? CUSTOM_START + " \u2192 " + CUSTOM_END : GRANULARITY) +
        '</div>' +
        '<a href="' + url + '" download style="display:block;text-align:center;background:#5dd3a8;color:#0a1419;padding:11px;border-radius:5px;font-weight:700;text-decoration:none;font-size:14px;">\u2B07 Download Excel</a>' +
        '<div style="font-size:11px;color:#525c66;text-align:center;margin-top:8px;">If download didn\'t auto-start, click the button above.</div>'
      );
      var a = document.createElement("a");
      a.href = url; a.download = "";
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      setBodyText("Submitted. Server is processing\u2026");
    }
  }

  // ── Entrypoint ───────────────────────────────────────────────
  async function run() {
    try {
      if (host === "partner.steamgames.com") await runSteamgames();
      else if (host === "partner.steampowered.com") await runSteampowered();
      else setBodyText("Open partner.steamgames.com first, log in, then click this bookmark.");
    } catch (e) {
      err((e && e.message) || String(e));
      console.error("[swexp]", e);
    }
  }

  window.__SWEXP_RUN__ = run;
  run();
})();
`;
