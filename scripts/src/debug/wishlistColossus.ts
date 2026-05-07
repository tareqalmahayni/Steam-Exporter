#!/usr/bin/env tsx
/**
 * Milestone 2 — Steam Wishlist API debug for Colossus (AppID 1722800).
 *
 * Goal: prove that real Steam wishlist data can be pulled from Steam
 * before connecting it to the tracker writer.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run debug:wishlist:colossus
 *   pnpm --filter @workspace/scripts run debug:wishlist:colossus -- --date 2026-05-01
 *   pnpm --filter @workspace/scripts run debug:wishlist:colossus -- --appid 1722800 --date 2026-05-01
 *
 * Endpoint:
 *   GET https://partner.steam-api.com/IPartnerFinancialsService
 *       /GetAppWishlistReporting/v001/?key=...&appid=...&date=YYYY-MM-DD
 *
 * No tracker writes. No Excel changes. No scraping. No impressions/visits.
 * Failed pulls are reported, NEVER silently coerced to 0 or "n/a".
 */

const COLOSSUS_APPID = "1722800";
const ENDPOINT =
  "https://partner.steam-api.com/IPartnerFinancialsService/GetAppWishlistReporting/v001/";

type FinalStatus =
  | "REAL_DATA"
  | "TRUE_ZERO_FROM_STEAM"
  | "EMPTY_RESPONSE"
  | "PERMISSION_ERROR"
  | "MISSING_FINANCIAL_KEY"
  | "APP_NOT_ACCESSIBLE"
  | "API_ERROR";

interface CliArgs {
  appid: string;
  date: string;
}

function parseArgs(argv: string[]): CliArgs {
  let appid = COLOSSUS_APPID;
  let date = yesterdayUtcIso();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--appid" && argv[i + 1]) {
      appid = String(argv[++i]);
    } else if (a === "--date" && argv[i + 1]) {
      date = String(argv[++i]);
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "Usage: debug:wishlist:colossus [-- --appid <id>] [--date YYYY-MM-DD]\n",
      );
      process.exit(0);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    process.stderr.write(`error: --date must be YYYY-MM-DD (got "${date}")\n`);
    process.exit(2);
  }
  if (!/^\d+$/.test(appid)) {
    process.stderr.write(`error: --appid must be numeric (got "${appid}")\n`);
    process.exit(2);
  }
  return { appid, date };
}

function yesterdayUtcIso(): string {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yyyy = y.getUTCFullYear();
  const mm = String(y.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(y.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function head(label: string): void {
  process.stdout.write(`\n=== ${label} ===\n`);
}

function line(n: number, label: string, value: unknown): void {
  const v =
    value === undefined
      ? "(undefined)"
      : value === null
        ? "(null)"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  process.stdout.write(`${String(n).padStart(2, " ")}. ${label.padEnd(36, " ")} ${v}\n`);
}

function deepFind(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === "object") {
      const found = deepFind(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function pickNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

async function main(): Promise<void> {
  const { appid, date } = parseArgs(process.argv.slice(2));
  const key = process.env.STEAM_FINANCIAL_KEY;
  const keyExists = typeof key === "string" && key.trim() !== "";

  head("Steam Wishlist API debug (Colossus)");
  line(1, "Date used (UTC)", date);
  line(2, "AppID used", appid);
  line(3, "STEAM_FINANCIAL_KEY exists", keyExists ? "YES" : "NO");

  if (!keyExists) {
    line(4, "Steam API HTTP status", "(not called)");
    line(5, "Raw Steam response", "(not called)");
    line(6, "Parsed wishlist summary", "(not called)");
    for (let i = 7; i <= 13; i++) line(i, fieldLabel(i), "(not called)");
    line(14, "country_summary present", "(not called)");
    line(15, "language_summary present", "(not called)");
    head("FINAL STATUS");
    line(16, "Final status", "MISSING_FINANCIAL_KEY");
    process.stdout.write(
      "\nSet the STEAM_FINANCIAL_KEY secret in Replit (Tools → Secrets) and re-run.\n",
    );
    process.exitCode = 1;
    return;
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", key as string);
  url.searchParams.set("appid", appid);
  url.searchParams.set("date", date);

  const safeUrl = `${ENDPOINT}?key=<redacted>&appid=${appid}&date=${date}`;
  process.stdout.write(`\nGET ${safeUrl}\n`);

  let httpStatus: number | "ERR" = "ERR";
  let rawText = "";
  let parsed: unknown = undefined;
  let parseError: string | undefined;
  let networkError: string | undefined;

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    httpStatus = res.status;
    rawText = await res.text();
    if (rawText.trim() !== "") {
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    networkError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  line(4, "Steam API HTTP status", networkError ? `ERR (${networkError})` : httpStatus);

  head("Raw Steam response");
  if (networkError) {
    process.stdout.write(`(network error — no body)\n`);
  } else if (rawText === "") {
    process.stdout.write("(empty body)\n");
  } else {
    const limit = 8000;
    if (rawText.length > limit) {
      process.stdout.write(`${rawText.slice(0, limit)}\n... [truncated ${rawText.length - limit} more chars]\n`);
    } else {
      process.stdout.write(`${rawText}\n`);
    }
    if (parseError) process.stdout.write(`\n(JSON parse failed: ${parseError})\n`);
  }
  line(5, "Raw response length (chars)", rawText.length);

  // Walk the response. Steam's IPartnerFinancialsService wraps things under
  // { response: { ... } }; field names below are based on the documented
  // schema. We deep-search to be tolerant of minor shape differences.
  const root = parsed && typeof parsed === "object" ? parsed : {};
  const wishlistAdds = pickNumber(deepFind(root, "wishlist_adds"));
  const wishlistDeletes = pickNumber(deepFind(root, "wishlist_deletes"));
  const wishlistPurchases = pickNumber(deepFind(root, "wishlist_purchases"));
  const wishlistGifts = pickNumber(deepFind(root, "wishlist_gifts"));
  const addsWindows = pickNumber(deepFind(root, "wishlist_adds_windows"));
  const addsMac = pickNumber(deepFind(root, "wishlist_adds_mac"));
  const addsLinux = pickNumber(deepFind(root, "wishlist_adds_linux"));
  const countrySummary = deepFind(root, "country_summary");
  const languageSummary = deepFind(root, "language_summary");

  const summary = {
    wishlist_adds: wishlistAdds ?? "(missing)",
    wishlist_deletes: wishlistDeletes ?? "(missing)",
    wishlist_purchases: wishlistPurchases ?? "(missing)",
    wishlist_gifts: wishlistGifts ?? "(missing)",
    wishlist_adds_windows: addsWindows ?? "(missing)",
    wishlist_adds_mac: addsMac ?? "(missing)",
    wishlist_adds_linux: addsLinux ?? "(missing)",
    country_summary: isPresent(countrySummary) ? "present" : "missing",
    language_summary: isPresent(languageSummary) ? "present" : "missing",
  };

  head("Parsed wishlist summary");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  line(6, "Parsed wishlist summary", "(see above)");
  line(7, "wishlist_adds", wishlistAdds ?? "(missing)");
  line(8, "wishlist_deletes", wishlistDeletes ?? "(missing)");
  line(9, "wishlist_purchases", wishlistPurchases ?? "(missing)");
  line(10, "wishlist_gifts", wishlistGifts ?? "(missing)");
  line(11, "wishlist_adds_windows", addsWindows ?? "(missing)");
  line(12, "wishlist_adds_mac", addsMac ?? "(missing)");
  line(13, "wishlist_adds_linux", addsLinux ?? "(missing)");
  line(14, "country_summary present", isPresent(countrySummary) ? "YES" : "NO");
  line(15, "language_summary present", isPresent(languageSummary) ? "YES" : "NO");

  // Decide final status
  let status: FinalStatus;
  let detail = "";

  const numericKeys = [
    wishlistAdds,
    wishlistDeletes,
    wishlistPurchases,
    wishlistGifts,
    addsWindows,
    addsMac,
    addsLinux,
  ];
  const anyNumericPresent = numericKeys.some((n) => n !== undefined);
  const allNumericZero =
    anyNumericPresent && numericKeys.every((n) => n === undefined || n === 0);
  const anyNumericNonZero = numericKeys.some((n) => typeof n === "number" && n !== 0);

  if (networkError) {
    status = "API_ERROR";
    detail = networkError;
  } else if (httpStatus === 401 || httpStatus === 403) {
    status = "PERMISSION_ERROR";
    detail = `HTTP ${httpStatus} — key rejected or no access to AppID ${appid}.`;
  } else if (httpStatus === 404) {
    status = "APP_NOT_ACCESSIBLE";
    detail = `HTTP 404 — Steam reports no such app or no access (AppID ${appid}).`;
  } else if (typeof httpStatus === "number" && httpStatus >= 400) {
    status = "API_ERROR";
    detail = `HTTP ${httpStatus}.`;
  } else if (parseError) {
    status = "API_ERROR";
    detail = `Response was not valid JSON: ${parseError}`;
  } else if (rawText.trim() === "" || !isPresent(parsed)) {
    status = "EMPTY_RESPONSE";
    detail = "Steam returned an empty body.";
  } else if (anyNumericNonZero || isPresent(countrySummary) || isPresent(languageSummary)) {
    status = "REAL_DATA";
  } else if (allNumericZero) {
    status = "TRUE_ZERO_FROM_STEAM";
    detail = "All wishlist counters are present and zero for the requested date.";
  } else {
    // We got a 200 + parseable JSON, but none of the expected wishlist fields
    // were found. Don't pretend it's real data — flag as empty so a human
    // looks at the raw body above.
    status = "EMPTY_RESPONSE";
    detail = "Response parsed, but no recognizable wishlist fields were found.";
  }

  head("FINAL STATUS");
  line(16, "Final status", status);
  if (detail) process.stdout.write(`     ${detail}\n`);

  process.exitCode = status === "REAL_DATA" || status === "TRUE_ZERO_FROM_STEAM" ? 0 : 1;
}

function fieldLabel(n: number): string {
  switch (n) {
    case 7:
      return "wishlist_adds";
    case 8:
      return "wishlist_deletes";
    case 9:
      return "wishlist_purchases";
    case 10:
      return "wishlist_gifts";
    case 11:
      return "wishlist_adds_windows";
    case 12:
      return "wishlist_adds_mac";
    case 13:
      return "wishlist_adds_linux";
    default:
      return `field ${n}`;
  }
}

main().catch((e) => {
  process.stderr.write(
    `\nUnhandled error in debug:wishlist:colossus — ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`,
  );
  process.exit(1);
});
