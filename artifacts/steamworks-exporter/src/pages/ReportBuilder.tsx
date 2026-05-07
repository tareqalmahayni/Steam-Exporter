/**
 * Milestone 7 — Web Report Builder.
 *
 * Single-page UI around the proven M6 reporting engine. Six sections:
 *   1. Setup status   (STEAM_FINANCIAL_KEY ready / missing)
 *   2. Select games   (5 checkboxes + Select All)
 *   3. Choose data    (Wishlist / Traffic / Both)
 *   4. Date range     (Latest week / Custom; default 2026-04-30 → 2026-05-06)
 *   5. Upload CSVs    (one per selected game; only when traffic is requested)
 *   6. Generate       (live progress log + auto-download)
 *
 * Add to Master Tracker is intentionally disabled ("Coming soon").
 *
 * No OpenAPI hooks for this milestone — raw fetch keeps scope tight and
 * sidesteps multipart codegen quirks (CSVs are sent as JSON text).
 */

import { useEffect, useMemo, useState } from "react";

interface SetupGame {
  id: string;
  cacheId: string;
  appid: string;
  displayName: string;
  trackingStartDate: string | null;
}

interface SetupResponse {
  status: "READY" | "MISSING_FINANCIAL_KEY";
  hasFinancialKey: boolean;
  games: SetupGame[];
  defaultWindow: { startIso: string; endIso: string };
}

interface PerGameStatus {
  appid: string;
  displayName: string;
  wishlistStatus: string;
  trafficStatus: string;
  warningCount: number;
  errorCount: number;
  warnings: string[];
  errors: string[];
}

interface GenerateResponse {
  status: "PASSED" | "PARTIAL" | "FAILED";
  jobId: string;
  filename: string;
  bytes: number;
  perGameStatus: PerGameStatus[];
  log: Array<{ game: string; event: string; detail: string }>;
}

type DataType = "wishlist" | "traffic" | "both";
type DateMode = "today" | "previousWeek" | "previousMonth" | "previousYear" | "lifetime" | "preference";

const DATE_MODE_LABEL: Record<DateMode, string> = {
  today: "Today",
  previousWeek: "Previous Week",
  previousMonth: "Previous Month",
  previousYear: "Previous Year",
  lifetime: "Lifetime",
  preference: "Preference",
};

const API = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

function expectedTrafficFilename(appid: string, displayName: string, startIso: string, endIso: string): string {
  // Same token table the lib uses (must stay in sync). Keep here so the UI can
  // show users what filename they should pick BEFORE upload.
  const tokenByAppId: Record<string, string> = {
    "1722800": "colossus",
    "2929040": "fleetbreakers",
    "3152750": "taival",
    "3728760": "noor",
    "4009450": "petunia",
  };
  const token = tokenByAppId[appid] ?? displayName.toLowerCase().replace(/[^a-z]+/g, "");
  const strip = (iso: string) => iso.replace(/-/g, "");
  return `traffic_${token}_${appid}_${strip(startIso)}_${strip(endIso)}.csv`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ReportBuilder() {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [dataType, setDataType] = useState<DataType>("both");
  const [dateMode, setDateMode] = useState<DateMode>("preference");
  const [startIso, setStartIso] = useState("2026-04-30");
  const [endIso, setEndIso] = useState("2026-05-06");
  const [trafficCsvs, setTrafficCsvs] = useState<Record<string, { fileName: string; text: string }>>({});

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load setup once.
  useEffect(() => {
    let cancelled = false;
    fetch(API("/combined/setup"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: SetupResponse) => { if (!cancelled) setSetup(data); })
      .catch((e: unknown) => { if (!cancelled) setSetupErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  const games = setup?.games ?? [];
  const allSelected = games.length > 0 && selectedAppIds.size === games.length;
  const trafficRequested = dataType === "traffic" || dataType === "both";
  const selectedGames = useMemo(
    () => games.filter((g) => selectedAppIds.has(g.appid)),
    [games, selectedAppIds],
  );

  // Earliest trackingStartDate among selected games (for Lifetime). null if any
  // selected game lacks one.
  const lifetimeStart: string | null = useMemo(() => {
    if (selectedGames.length === 0) return null;
    const dates = selectedGames.map((g) => g.trackingStartDate);
    if (dates.some((d) => !d)) return null;
    return (dates as string[]).reduce((a, b) => (a < b ? a : b));
  }, [selectedGames]);

  // For Lifetime / Today: end = today (proxy for "latest available completed
  // Steam reporting date"). The UI surfaces a notice for Today since Steam
  // sometimes hasn't published today's numbers yet.
  const todayIso = isoToday();

  // Compute the canonical (start, end) for the active dateMode. For
  // "preference" we trust the user-controlled state values; for the rolling
  // modes we recompute on every render so they always reflect today.
  const { computedStart, computedEnd, dateModeBlocker } = useMemo(() => {
    if (dateMode === "today") {
      return { computedStart: todayIso, computedEnd: todayIso, dateModeBlocker: null as string | null };
    }
    if (dateMode === "previousWeek") {
      return { computedStart: isoNDaysAgo(6), computedEnd: todayIso, dateModeBlocker: null };
    }
    if (dateMode === "previousMonth") {
      return { computedStart: isoNDaysAgo(29), computedEnd: todayIso, dateModeBlocker: null };
    }
    if (dateMode === "previousYear") {
      return { computedStart: isoNDaysAgo(364), computedEnd: todayIso, dateModeBlocker: null };
    }
    if (dateMode === "lifetime") {
      if (selectedGames.length === 0) {
        return { computedStart: "", computedEnd: todayIso, dateModeBlocker: "Pick at least one game to compute Lifetime." };
      }
      const missing = selectedGames.filter((g) => !g.trackingStartDate).map((g) => g.displayName);
      if (missing.length > 0) {
        return {
          computedStart: "",
          computedEnd: todayIso,
          dateModeBlocker: `MISSING_TRACKING_START_DATE — ${missing.join(", ")}. Add a trackingStartDate for each in GAME_SPECS (lib/combined-export/src/games.ts).`,
        };
      }
      return { computedStart: lifetimeStart ?? "", computedEnd: todayIso, dateModeBlocker: null };
    }
    return { computedStart: startIso, computedEnd: endIso, dateModeBlocker: null };
  }, [dateMode, todayIso, selectedGames, lifetimeStart, startIso, endIso]);

  // Push computed values back into startIso / endIso whenever the active mode
  // is one of the rolling modes (so Generate sends the right window).
  useEffect(() => {
    if (dateMode !== "preference" && computedStart && computedEnd) {
      setStartIso(computedStart);
      setEndIso(computedEnd);
    }
  }, [dateMode, computedStart, computedEnd]);

  const toggleGame = (appid: string) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appid)) next.delete(appid);
      else next.add(appid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedAppIds(new Set());
    else setSelectedAppIds(new Set(games.map((g) => g.appid)));
  };

  const handleCsvUpload = async (appid: string, file: File | null) => {
    if (!file) {
      setTrafficCsvs((prev) => {
        const next = { ...prev };
        delete next[appid];
        return next;
      });
      return;
    }
    const text = await file.text();
    setTrafficCsvs((prev) => ({ ...prev, [appid]: { fileName: file.name, text } }));
  };

  const validation = useMemo(() => {
    const errs: string[] = [];
    if (!setup) return { errs, ok: false };
    if (selectedAppIds.size === 0) errs.push("Pick at least one game.");
    if (dateModeBlocker) errs.push(dateModeBlocker);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) errs.push("Start and end dates must be YYYY-MM-DD.");
    else if (startIso > endIso) errs.push(`Start date (${startIso}) is after end date (${endIso}).`);
    else if (endIso > isoToday()) errs.push("End date cannot be in the future.");
    if ((dataType === "wishlist" || dataType === "both") && setup && !setup.hasFinancialKey) {
      errs.push("STEAM_FINANCIAL_KEY is not configured on the server — wishlist pulls will fail.");
    }
    return { errs, ok: errs.length === 0 };
  }, [setup, selectedAppIds, startIso, endIso, dataType, dateModeBlocker]);

  const generate = async () => {
    setBusy(true);
    setErrorMsg(null);
    setResult(null);
    setProgress([]);
    const append = (line: string) => setProgress((prev) => [...prev, line]);

    append(`READY — ${selectedAppIds.size} game${selectedAppIds.size === 1 ? "" : "s"} selected, dataType=${dataType}, window=${startIso} → ${endIso}`);
    if (trafficRequested) {
      const missing: string[] = [];
      for (const appid of selectedAppIds) {
        if (!trafficCsvs[appid]) {
          const g = games.find((x) => x.appid === appid);
          missing.push(`${g?.displayName ?? appid} (${appid})`);
        }
      }
      if (missing.length > 0) {
        append(`TRAFFIC_CSV_MISSING for: ${missing.join(", ")} — those games will appear as TRAFFIC_CSV_MISSING in the workbook.`);
      }
    }
    if (dataType !== "traffic") append("PULLING_WISHLIST — calling Steam Partner Financial API...");
    if (dataType !== "wishlist") append("PARSING_TRAFFIC — uploaded CSVs will be parsed server-side...");
    append("GENERATING_EXCEL — building workbook...");

    try {
      const body = {
        selectedAppIds: Array.from(selectedAppIds),
        dataType,
        window: { startIso, endIso },
        trafficCsvs: trafficRequested ? trafficCsvs : {},
      };
      const res = await fetch(API("/combined/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: GenerateResponse | { status: string; error: string } = await res.json();
      if (!res.ok || "error" in data) {
        const err = "error" in data ? data.error : `HTTP ${res.status}`;
        append(`FAILED — ${err}`);
        setErrorMsg(err);
        setBusy(false);
        return;
      }
      const ok = data as GenerateResponse;
      for (const e of ok.log) append(`[${e.game}] ${e.event} — ${e.detail}`);
      append(`${ok.status} — workbook ready (${(ok.bytes / 1024).toFixed(1)} KB). Downloading...`);
      setResult(ok);

      // Auto-download.
      const link = document.createElement("a");
      link.href = API(`/combined/download/${ok.jobId}`);
      link.download = ok.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      append(`FAILED — ${msg}`);
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  if (setupErr) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="max-w-lg space-y-3 text-center">
          <h1 className="text-2xl font-bold text-destructive">Setup error</h1>
          <p className="text-sm text-muted-foreground">{setupErr}</p>
        </div>
      </div>
    );
  }
  if (!setup) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Steamworks Publisher Stats Exporter</h1>
          <p className="text-sm text-muted-foreground">
            Pull live wishlist data, parse uploaded traffic CSVs, and download a single combined Excel workbook (one tab per game).
          </p>
        </header>

        {/* 1. Setup */}
        <Section title="1. Setup status">
          <div className="flex items-center gap-2 text-sm">
            <StatusDot ok={setup.hasFinancialKey} />
            <span>
              {setup.hasFinancialKey
                ? "READY — STEAM_FINANCIAL_KEY is configured on the server."
                : "MISSING_FINANCIAL_KEY — set STEAM_FINANCIAL_KEY in environment variables to enable wishlist pulls."}
            </span>
          </div>
        </Section>

        {/* 2. Games */}
        <Section title="2. Select games">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} data-testid="checkbox-select-all" />
              Select All ({games.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
              {games.map((g) => (
                <label key={g.appid} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAppIds.has(g.appid)}
                    onChange={() => toggleGame(g.appid)}
                    data-testid={`checkbox-game-${g.id}`}
                  />
                  <span>{g.displayName}</span>
                  <span className="text-xs text-muted-foreground">({g.appid})</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Data type */}
        <Section title="3. Data type">
          <div className="flex flex-wrap gap-4 text-sm">
            {(["wishlist", "traffic", "both"] as const).map((dt) => (
              <label key={dt} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dataType"
                  value={dt}
                  checked={dataType === dt}
                  onChange={() => setDataType(dt)}
                  data-testid={`radio-data-${dt}`}
                />
                <span className="capitalize">{dt}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* 4. Date range */}
        <Section title="4. Date range">
          <div className="space-y-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Range</span>
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value as DateMode)}
                className="border rounded px-2 py-1 bg-background w-full sm:w-80"
                data-testid="select-date-mode"
              >
                {(Object.keys(DATE_MODE_LABEL) as DateMode[]).map((m) => (
                  <option key={m} value={m}>{DATE_MODE_LABEL[m]}</option>
                ))}
              </select>
            </label>

            {dateModeBlocker ? (
              <div className="text-xs text-amber-600" data-testid="text-date-blocker">{dateModeBlocker}</div>
            ) : (
              <div className="text-xs text-muted-foreground" data-testid="text-date-computed">
                <span className="font-medium text-foreground">Start:</span> {computedStart || "—"}
                {"  "}
                <span className="font-medium text-foreground">End:</span> {computedEnd || "—"}
                {dateMode === "today" && (
                  <div className="mt-1 text-amber-600">
                    Today's Steam report may not be available yet. Showing the latest available completed reporting date if Steam has not published today's numbers.
                  </div>
                )}
                {dateMode === "lifetime" && lifetimeStart && (
                  <div className="mt-1">
                    Earliest trackingStartDate across selected games: {lifetimeStart}.
                  </div>
                )}
              </div>
            )}

            {dateMode === "preference" && (
              <div className="flex flex-wrap gap-3 items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <input
                    type="date"
                    value={startIso}
                    max={isoToday()}
                    onChange={(e) => setStartIso(e.target.value)}
                    className="border rounded px-2 py-1 bg-background"
                    data-testid="input-start-date"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">End Date</span>
                  <input
                    type="date"
                    value={endIso}
                    max={isoToday()}
                    onChange={(e) => setEndIso(e.target.value)}
                    className="border rounded px-2 py-1 bg-background"
                    data-testid="input-end-date"
                  />
                </label>
              </div>
            )}
          </div>
        </Section>

        {/* 5. Upload CSVs */}
        {trafficRequested && (
          <Section title="5. Fallback: Upload Traffic CSV Manually">
            {selectedAppIds.size === 0 ? (
              <p className="text-sm text-muted-foreground">Pick at least one game above.</p>
            ) : (
              <div className="space-y-3">
                {Array.from(selectedAppIds).map((appid) => {
                  const g = games.find((x) => x.appid === appid);
                  if (!g) return null;
                  const expected = expectedTrafficFilename(g.appid, g.displayName, startIso, endIso);
                  const uploaded = trafficCsvs[appid];
                  return (
                    <div key={appid} className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{g.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Expected: <code>{expected}</code>
                        </div>
                        {uploaded && (
                          <div className="text-xs text-emerald-600">
                            Uploaded: {uploaded.fileName} ({(uploaded.text.length / 1024).toFixed(1)} KB)
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => handleCsvUpload(appid, e.target.files?.[0] ?? null)}
                        className="text-xs"
                        data-testid={`input-csv-${g.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* 6. Generate */}
        <Section title="6. Generate report">
          {/* Date Confirmation block — shows exactly what will be sent, so the
              user can never be surprised by silent shifts (Taival 481 vs 421
              issue). Also surfaces expected traffic CSV filenames per game. */}
          <div className="text-xs border rounded p-3 mb-3 space-y-1 bg-muted/20" data-testid="block-date-confirmation">
            <div><span className="font-medium">Selected preset:</span> {DATE_MODE_LABEL[dateMode]}</div>
            <div><span className="font-medium">Runtime today:</span> {todayIso}</div>
            <div><span className="font-medium">Calculated start date:</span> {dateModeBlocker ? "—" : (computedStart || "—")}</div>
            <div><span className="font-medium">Calculated end date:</span> {dateModeBlocker ? "—" : (computedEnd || "—")}</div>
            <div>
              <span className="font-medium">Selected games:</span>{" "}
              {selectedGames.length === 0 ? "—" : selectedGames.map((g) => g.displayName).join(", ")}
            </div>
            <div><span className="font-medium">Selected data type:</span> {dataType}</div>
            {trafficRequested && selectedGames.length > 0 && !dateModeBlocker && (
              <div className="pt-2">
                <div className="font-medium mb-1">Traffic CSV pre-flight (fallback mode):</div>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="border-b py-1 pr-2">Game</th>
                      <th className="border-b py-1 pr-2">Expected CSV</th>
                      <th className="border-b py-1 pr-2">Found?</th>
                      <th className="border-b py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGames.map((g) => {
                      const expected = expectedTrafficFilename(g.appid, g.displayName, computedStart, computedEnd);
                      const uploaded = trafficCsvs[g.appid];
                      let status: "READY" | "TRAFFIC_CSV_MISSING" | "TRAFFIC_CSV_DATE_RANGE_MISMATCH" = "TRAFFIC_CSV_MISSING";
                      if (uploaded) {
                        status = uploaded.fileName === expected ? "READY" : "TRAFFIC_CSV_DATE_RANGE_MISMATCH";
                      }
                      const cls = status === "READY" ? "text-emerald-600"
                        : status === "TRAFFIC_CSV_MISSING" ? "text-amber-600" : "text-red-600";
                      return (
                        <tr key={g.appid} data-testid={`row-traffic-preflight-${g.id}`}>
                          <td className="py-1 pr-2 align-top">{g.displayName}</td>
                          <td className="py-1 pr-2 align-top font-mono break-all">{expected}</td>
                          <td className="py-1 pr-2 align-top">{uploaded ? "YES" : "NO"}</td>
                          <td className={`py-1 align-top ${cls}`}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pt-2 text-amber-600">Wishlist totals depend on the selected date range.</div>
          </div>
          {validation.errs.length > 0 && (
            <ul className="text-xs text-amber-600 list-disc pl-5 mb-3">
              {validation.errs.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy || selectedAppIds.size === 0}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              data-testid="button-generate"
            >
              {busy ? "Generating…" : "Generate Report (Pull Data Alone)"}
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="px-4 py-2 rounded border text-sm font-medium opacity-50 cursor-not-allowed"
              data-testid="button-add-to-tracker"
            >
              Add to Master Tracker (Coming soon)
            </button>
          </div>

          {(progress.length > 0 || errorMsg) && (
            <pre
              className="mt-4 max-h-64 overflow-auto bg-muted/50 border rounded p-3 text-[11px] font-mono leading-snug whitespace-pre-wrap"
              data-testid="text-progress-log"
            >
              {progress.join("\n")}
              {errorMsg ? `\n\nERROR: ${errorMsg}` : ""}
            </pre>
          )}

          {result && (
            <div className="mt-4 border rounded p-3 space-y-2 text-sm">
              <div className="font-medium">
                Final status: <StatusBadge status={result.status} /> —{" "}
                <a className="text-primary underline" href={API(`/combined/download/${result.jobId}`)} download={result.filename} data-testid="link-download">
                  Re-download {result.filename}
                </a>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border px-2 py-1">Game</th>
                    <th className="border px-2 py-1">Wishlist</th>
                    <th className="border px-2 py-1">Traffic</th>
                    <th className="border px-2 py-1">Warns</th>
                    <th className="border px-2 py-1">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perGameStatus.map((g) => (
                    <tr key={g.appid}>
                      <td className="border px-2 py-1">{g.displayName}</td>
                      <td className="border px-2 py-1">{g.wishlistStatus}</td>
                      <td className="border px-2 py-1">{g.trafficStatus}</td>
                      <td className="border px-2 py-1 text-amber-600">{g.warningCount}</td>
                      <td className="border px-2 py-1 text-destructive">{g.errorCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-lg p-4 space-y-3 bg-card">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />;
}

function StatusBadge({ status }: { status: "PASSED" | "PARTIAL" | "FAILED" }) {
  const cls = status === "PASSED" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/40"
    : status === "PARTIAL" ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
    : "bg-destructive/15 text-destructive border-destructive/40";
  return <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>{status}</span>;
}
