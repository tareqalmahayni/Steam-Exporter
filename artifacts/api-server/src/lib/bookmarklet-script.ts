/**
 * The bookmarklet payload script. Served by GET /api/bookmarklet.js with
 * `__SERVER_ORIGIN__` substituted for the actual server origin at request time.
 *
 * This script runs IN THE USER'S BROWSER on partner.steamgames.com or
 * partner.steampowered.com. It uses the user's already-logged-in session
 * (via `fetch(..., {credentials: 'include'})`) to scrape stat pages, then
 * POSTs raw HTML to our server. The server runs the existing parsers
 * against the submitted HTML.
 *
 * Why this works when cookie-paste from Replit doesn't:
 * - Steam binds JWT refresh to client IP. Cookies pasted to a Replit data
 *   center IP get rejected at login.steampowered.com/jwt/refresh. Fetching
 *   from the user's own browser IP works fine.
 */
export const bookmarkletScript = String.raw`
(function() {
  // Re-clicking the bookmarklet on the same page should re-run, not double-load.
  if (window.__SWEXP_LOADED__) {
    if (typeof window.__SWEXP_RUN__ === "function") window.__SWEXP_RUN__();
    return;
  }
  window.__SWEXP_LOADED__ = true;

  var SERVER = "__SERVER_ORIGIN__";
  var host = location.hostname;

  // ── Overlay UI ───────────────────────────────────────────────
  var overlay = document.createElement("div");
  overlay.id = "swexp-overlay";
  overlay.style.cssText = [
    "position:fixed","top:20px","right:20px","width:400px",
    "background:#1b2838","color:#c7d5e0",
    "border:2px solid #66c0f4","border-radius:8px","padding:16px",
    "font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "z-index:2147483647","box-shadow:0 8px 32px rgba(0,0,0,0.6)"
  ].join(";");
  overlay.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<div style="font-size:15px;font-weight:600;color:#66c0f4;">Steamworks Exporter</div>' +
      '<button id="swexp-close" style="background:none;border:none;color:#8f98a0;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">&times;</button>' +
    '</div>' +
    '<div id="swexp-status" style="margin-bottom:6px;">Initializing&hellip;</div>' +
    '<div id="swexp-progress" style="font-size:12px;color:#8f98a0;min-height:1em;"></div>' +
    '<div id="swexp-actions" style="margin-top:12px;font-size:13px;"></div>';
  document.body.appendChild(overlay);
  document.getElementById("swexp-close").onclick = function() {
    overlay.remove();
    window.__SWEXP_LOADED__ = false;
  };

  function setStatus(s) { var el = document.getElementById("swexp-status"); if (el) el.textContent = s; }
  function setProgress(s) { var el = document.getElementById("swexp-progress"); if (el) el.textContent = s; }
  function setActions(html) { var el = document.getElementById("swexp-actions"); if (el) el.innerHTML = html; }
  function err(msg) {
    setStatus("\u274C " + msg);
    setProgress("");
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  async function fetchHtml(url) {
    var r = await fetch(url, { credentials: "include", headers: { "Accept": "text/html" } });
    return await r.text();
  }

  async function pullDomain(urls, label) {
    var htmlByUrl = {};
    var failures = 0;
    for (var i = 0; i < urls.length; i++) {
      setProgress(label + " " + (i + 1) + " of " + urls.length);
      try {
        htmlByUrl[urls[i]] = await fetchHtml(urls[i]);
      } catch (e) {
        failures++;
      }
      await sleep(400); // be polite to Steam
    }
    return { htmlByUrl: htmlByUrl, failures: failures };
  }

  async function runSteamgames() {
    setStatus("Reading your Steamworks home page\u2026");
    var homeHtml;
    try {
      homeHtml = await fetchHtml("/home");
    } catch (e) {
      err("Could not load /home. Are you logged in?");
      return;
    }

    setStatus("Asking server to plan the pull\u2026");
    var initR = await fetch(SERVER + "/api/browser-pull/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeHtml: homeHtml, granularity: "monthly" })
    });
    if (!initR.ok) {
      var t = await initR.text();
      err("Server rejected init (" + initR.status + "): " + t.slice(0, 200));
      return;
    }
    var init = await initR.json();
    setStatus("Found " + init.gameCount + " game(s). Pulling traffic stats\u2026");

    var pulled = await pullDomain(init.steamgamesUrls, "Game");

    setStatus("Submitting " + Object.keys(pulled.htmlByUrl).length + " page(s)\u2026");
    var subR = await fetch(SERVER + "/api/browser-pull/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: init.sessionId,
        domain: "steamgames",
        htmlByUrl: pulled.htmlByUrl
      })
    });
    if (!subR.ok) { err("Submit failed: " + subR.status); return; }

    setStatus("\u2705 Step 1 of 2 complete.");
    setProgress(init.gameCount + " games detected. " + Object.keys(pulled.htmlByUrl).length + " traffic pages collected.");
    setActions(
      'Now click the bookmark on <a href="https://partner.steampowered.com/" target="_blank" style="color:#66c0f4;">partner.steampowered.com</a> to finish.'
    );
  }

  async function runSteampowered() {
    setStatus("Looking up your active export\u2026");
    var ar = await fetch(SERVER + "/api/browser-pull/active");
    if (!ar.ok) {
      err("No active export. Click the bookmark on partner.steamgames.com first.");
      return;
    }
    var active = await ar.json();
    setStatus("Pulling stats for " + active.gameCount + " game(s)\u2026");

    var pulled = await pullDomain(active.steampoweredUrls, "Page");

    setStatus("Submitting & generating Excel\u2026");
    var subR = await fetch(SERVER + "/api/browser-pull/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: active.sessionId,
        domain: "steampowered",
        htmlByUrl: pulled.htmlByUrl
      })
    });
    if (!subR.ok) { err("Submit failed: " + subR.status + " " + (await subR.text()).slice(0, 200)); return; }
    var result = await subR.json();

    if (result.downloadUrl) {
      setStatus("\u2705 All done! Downloading Excel\u2026");
      setProgress(Object.keys(pulled.htmlByUrl).length + " page(s) collected.");
      var url = SERVER + result.downloadUrl;
      setActions('<a href="' + url + '" download style="color:#66c0f4;font-weight:600;">Click here if the download didn\'t start.</a>');
      // Auto-trigger download
      var a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      setStatus("Submitted. Server still processing\u2026");
    }
  }

  async function run() {
    try {
      if (host === "partner.steamgames.com") {
        await runSteamgames();
      } else if (host === "partner.steampowered.com") {
        await runSteampowered();
      } else {
        setStatus("Open partner.steamgames.com first, log in, then click this bookmark.");
      }
    } catch (e) {
      err((e && e.message) || String(e));
      console.error("[swexp]", e);
    }
  }

  window.__SWEXP_RUN__ = run;
  run();
})();
`;
