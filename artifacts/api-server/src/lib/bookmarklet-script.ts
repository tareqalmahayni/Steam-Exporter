/**
 * The bookmarklet payload script.
 *
 * The script is INLINED into the `javascript:` URL itself by the React install
 * page (which fetches GET /api/bookmarklet.js once and encodes it). We do NOT
 * inject a remote `<script src=...>` tag, because Steamworks pages enforce a
 * Content Security Policy that blocks loading external scripts.
 *
 * `__SERVER_ORIGIN__` is substituted server-side so the bookmarklet knows
 * which API host to POST data back to.
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

  // ── Overlay UI ───────────────────────────────────────────────
  var overlay = document.createElement("div");
  overlay.id = "swexp-overlay";
  overlay.style.cssText = [
    "position:fixed","top:20px","right:20px","width:420px","max-height:85vh","overflow:auto",
    "background:#1b2838","color:#c7d5e0",
    "border:2px solid #66c0f4","border-radius:8px","padding:16px",
    "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "z-index:2147483647","box-shadow:0 8px 32px rgba(0,0,0,0.6)"
  ].join(";");
  overlay.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<div style="font-size:15px;font-weight:600;color:#66c0f4;">Steamworks Exporter</div>' +
      '<button id="swexp-close" style="background:none;border:none;color:#8f98a0;cursor:pointer;font-size:20px;line-height:1;padding:0 4px;">&times;</button>' +
    '</div>' +
    '<div id="swexp-body">Initializing&hellip;</div>';
  document.body.appendChild(overlay);
  document.getElementById("swexp-close").onclick = function() {
    overlay.remove();
    window.__SWEXP_LOADED__ = false;
  };

  function setBody(html) { var el = document.getElementById("swexp-body"); if (el) el.innerHTML = html; }
  function setBodyText(s)  { var el = document.getElementById("swexp-body"); if (el) el.textContent = s; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }
  function err(msg) { setBody('<div style="color:#ff6b6b;">\u274C ' + esc(msg) + '</div>'); }

  function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

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
      await sleep(400); // be polite to Steam
    }
    return htmlByUrl;
  }

  // ── Picker overlay (steamgames step) ─────────────────────────
  function showPicker(games, sessionId) {
    var rows = games.map(function(g) {
      return '<label style="display:flex;align-items:center;padding:3px 0;gap:8px;font-size:13px;cursor:pointer;">' +
        '<input type="checkbox" class="swexp-game" value="' + g.appId + '" checked>' +
        '<span style="flex:1;">' + esc(g.name) + '</span>' +
        '<span style="color:#8f98a0;font-size:11px;">' + g.appId + '</span>' +
        '</label>';
    }).join("");

    setBody(
      '<div style="margin-bottom:10px;">Found <strong>' + games.length + '</strong> game(s). Pick what to export:</div>' +
      '<div style="display:flex;gap:6px;font-size:12px;margin-bottom:6px;">' +
        '<button id="swexp-all"  style="background:#2a475e;color:#c7d5e0;border:1px solid #66c0f4;border-radius:3px;padding:3px 10px;cursor:pointer;">All</button>' +
        '<button id="swexp-none" style="background:#2a475e;color:#c7d5e0;border:1px solid #66c0f4;border-radius:3px;padding:3px 10px;cursor:pointer;">None</button>' +
      '</div>' +
      '<div style="max-height:240px;overflow:auto;border:1px solid #2a475e;border-radius:4px;padding:6px 10px;margin-bottom:12px;background:#0e1822;">' + rows + '</div>' +
      '<label style="display:block;margin-bottom:12px;font-size:13px;">Date range:' +
        '<select id="swexp-gran" style="display:block;width:100%;margin-top:4px;background:#2a475e;color:#c7d5e0;border:1px solid #66c0f4;border-radius:3px;padding:6px;font-size:13px;">' +
          '<option value="daily">Last 1 day (Daily)</option>' +
          '<option value="weekly">Last 7 days (Weekly)</option>' +
          '<option value="monthly" selected>Last 30 days (Monthly)</option>' +
          '<option value="lifetime">All time (Lifetime)</option>' +
        '</select>' +
      '</label>' +
      '<button id="swexp-pull" style="background:#66c0f4;color:#0a1419;border:none;border-radius:4px;padding:10px;width:100%;font-weight:600;cursor:pointer;font-size:14px;">Pull stats \u2192</button>'
    );

    document.getElementById("swexp-all").onclick  = function(){ document.querySelectorAll(".swexp-game").forEach(function(c){ c.checked = true; }); };
    document.getElementById("swexp-none").onclick = function(){ document.querySelectorAll(".swexp-game").forEach(function(c){ c.checked = false; }); };
    document.getElementById("swexp-pull").onclick = function() {
      var selected = Array.prototype.slice.call(document.querySelectorAll(".swexp-game:checked"))
        .map(function(c){ return parseInt(c.value, 10); });
      var gran = document.getElementById("swexp-gran").value;
      if (selected.length === 0) { alert("Pick at least one game."); return; }
      configureAndPull(sessionId, selected, gran).catch(function(e){ err((e && e.message) || String(e)); });
    };
  }

  async function configureAndPull(sessionId, selectedAppIds, granularity) {
    setBodyText("Configuring (" + selectedAppIds.length + " game(s), " + granularity + ")\u2026");
    var cfg = await postJson("/api/browser-pull/configure", {
      sessionId: sessionId, selectedAppIds: selectedAppIds, granularity: granularity
    });

    var html1 = await pullPages(cfg.steamgamesUrls, function(i, n) {
      setBodyText("Fetching traffic page " + (i + 1) + " of " + n + "\u2026");
    });

    setBodyText("Submitting traffic data\u2026");
    await postJson("/api/browser-pull/submit", {
      sessionId: sessionId, domain: "steamgames", htmlByUrl: html1
    });

    setBody(
      '<div style="color:#5dd3a8;font-weight:600;">\u2705 Step 1 of 2 complete.</div>' +
      '<div style="margin-top:8px;font-size:13px;color:#8f98a0;">' + Object.keys(html1).length + ' traffic page(s) collected.</div>' +
      '<div style="margin-top:14px;font-size:13px;">Now click the bookmark on ' +
      '<a href="https://partner.steampowered.com/" target="_blank" style="color:#66c0f4;font-weight:600;">partner.steampowered.com</a> to finish.</div>'
    );
  }

  // ── Steamgames domain ────────────────────────────────────────
  async function runSteamgames() {
    setBodyText("Reading your Steamworks home page\u2026");
    var homeHtml;
    try { homeHtml = await fetchHtml("/home"); }
    catch (_e) { err("Could not load /home. Are you logged in?"); return; }

    setBodyText("Asking server to detect your games\u2026");
    var init = await postJson("/api/browser-pull/init", { homeHtml: homeHtml, granularity: "monthly" });
    if (!init.games || init.games.length === 0) { err("No games detected on /home."); return; }

    showPicker(init.games, init.sessionId);
  }

  // ── Steampowered domain ──────────────────────────────────────
  async function runSteampowered() {
    setBodyText("Looking up your active export\u2026");
    var ar;
    try { ar = await fetch(SERVER + "/api/browser-pull/active"); }
    catch (_e) { err("Could not reach the export server."); return; }
    if (!ar.ok) { err("No active export. Click the bookmark on partner.steamgames.com first."); return; }
    var active = await ar.json();

    var html2 = await pullPages(active.steampoweredUrls, function(i, n) {
      setBodyText("Fetching page " + (i + 1) + " of " + n + "\u2026");
    });

    setBodyText("Submitting & generating Excel\u2026");
    var result = await postJson("/api/browser-pull/submit", {
      sessionId: active.sessionId, domain: "steampowered", htmlByUrl: html2
    });

    if (result.downloadUrl) {
      var url = SERVER + result.downloadUrl;
      setBody(
        '<div style="color:#5dd3a8;font-weight:600;">\u2705 All done! Downloading Excel\u2026</div>' +
        '<div style="margin-top:8px;font-size:13px;color:#8f98a0;">' + Object.keys(html2).length + ' page(s) collected.</div>' +
        '<div style="margin-top:12px;"><a href="' + url + '" download style="color:#66c0f4;font-weight:600;">Click here if download didn\'t start.</a></div>'
      );
      var a = document.createElement("a");
      a.href = url; a.download = "";
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      setBodyText("Submitted. Server still processing\u2026");
    }
  }

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
