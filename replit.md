# Steamworks Publisher Stats Exporter

A downloadable Electron desktop app that signs in to Steamworks in an embedded browser window, pulls stats for each base game, and saves a single Excel file (one tab per game).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server in Replit (web preview / iteration)
- `pnpm --filter @workspace/steamworks-exporter run dev` — run the React UI
- `pnpm --filter @workspace/desktop run dev` — build & launch the Electron app locally
- `pnpm --filter @workspace/desktop run package` — produce installer for the current OS (`desktop/release/`)
- `pnpm --filter @workspace/desktop run package:mac|:win|:linux` — per-platform installers
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas after editing the spec
- Required env: none (no database — stateless per-session)

Cross-platform installers: see `.github/workflows/build-desktop.yml` (push a `v*` tag or trigger manually).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, shadcn/ui, Tailwind, TanStack Query, Wouter
- API: Express 5
- Desktop wrapper: Electron 33 + electron-builder 25
- Scraping: cheerio + native fetch
- Excel: exceljs
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/steamworks-exporter/src/` — React frontend
  - `components/DesktopApp.tsx` — Electron-mode shell: Steam login → game picker → pull
  - `components/StepPickGames.tsx` — game selection + date presets
  - `components/StepPull.tsx` — pull with live progress + download
  - `types/desktop.d.ts` — `window.desktop` preload-bridge types
- `artifacts/api-server/src/` — Express API
  - `routes/{health,connection,games,pull}.ts`
  - `lib/steamworks.ts` — scraping + `getDateRangeIso`
  - `lib/excel.ts` — Excel generation
- `desktop/` — Electron app
  - `src/main.ts` — main process: spawns api-server, opens window, handles Steam-login IPC
  - `src/preload.ts` — exposes `window.desktop` bridge
  - `scripts/build-main.mjs` — esbuild for main + preload
  - `scripts/bundle-resources.mjs` — copies api-server + frontend builds into `desktop/dist/{server,web}`. Frontend source is `artifacts/steamworks-exporter/dist/public/` (Vite's `build.outDir`), NOT the parent `dist/` — copying the parent makes Express's SPA fallback fail with "Cannot GET /" in the packaged app.
- `.github/workflows/build-desktop.yml` — Mac/Win/Linux installer build

## Architecture decisions

- **Electron desktop app is the only supported flow.** The previous bookmarklet and cookie-paste flows were retired because Steam's `login.steampowered.com/jwt/refresh` is IP-bound and silently rejects logins from data-center IPs (Replit, AWS, etc.). Running in the user's own browser process bypasses this entirely.
- **Single-origin in the desktop window.** Electron main spawns the api-server (`dist/index.mjs`) as a child process with `PORT=0` (random free port) and `FRONTEND_DIR=<bundled web dir>`. The server prints `LISTENING_ON_PORT=<n>` to stdout; the main process reads it, polls `/api/healthz`, then loads `http://127.0.0.1:<port>/`. Express serves both `/api/*` and the static React build, so the renderer talks to a single origin.
- **Steam login via second BrowserWindow.** Clicking "Sign in" opens a modal `BrowserWindow` on a `persist:steam-login` partition pointed at `partner.steamgames.com/home`. After the user signs in (including 2FA), the main process reads `sessionid` + `steamLoginSecure` cookies for both `steamgames.com` and `steampowered.com` domains and hands them to the renderer via `window.desktop.loginToSteam()`. The renderer then uses them with the existing `/api/connection/test`, `/api/games/list`, `/api/pull/*` endpoints — no protocol changes.
- **Date presets** — `getDateRangeIso(granularity, customRange?)` supports: `today`, `previous-month` (last calendar month), `previous-year` (last calendar year, Jan 1 → Dec 31), `lifetime` (since 2003), `custom` (caller-provided start/end ISO). Legacy `daily`/`weekly`/`monthly`/`yearly` aliases retained for back-compat. The `/pull/start` route validates custom ranges (rejects missing fields, `start > end`, and `end > today`).
- **Cookie persistence + auto-login** — Electron's `persist:steam-login` partition keeps cookies across launches automatically. `desktop:getStoredSteamCookies` IPC reads them on app start; renderer auto-validates via `/connection/test` and skips the login screen on success. `desktop:clearStoredSteamCookies` wipes the partition on Sign Out or auth failure.
- **Per-game totals reveal** — clicking a game row in the picker calls `POST /games/totals`, which reuses `fetchWishlists` + `fetchVisits` with `lifetime` granularity to return Total Wishlists / Impressions / Visits for that game.
- **GitHub Releases** — `.github/workflows/build-desktop.yml` uses `softprops/action-gh-release@v2` to publish Mac/Win/Linux installers automatically when a `v*` tag is pushed.
- **No database, no persistence.** Pull jobs live in-memory (TTL: 2h). Closing the window discards everything.
- **Per-metric resilience** — each stat module catches errors independently; one failure doesn't kill the whole pull.

## Product

- **Step 1 — Sign in to Steam** (Electron only): one-button sign-in via embedded BrowserWindow; cookies captured locally.
- **Step 2 — Pick games & date range**: checkbox list of base games; pick one of Today / Previous Month / Previous Year / Lifetime / Custom (Custom range capped at today).
- **Step 3 — Pull**: live progress bar, cancel button, auto-download Excel on completion, re-download button.

## User preferences

- Excel is the deliverable — no charts, no scheduling, no saved login
- Each metric is a separate independent module so a break in one doesn't kill others
- Visible progress at every step; do not stop and ask questions mid-build

## Gotchas

- Steam may change partner-site HTML at any time — each metric module should be maintained independently
- 400-600ms polite delays between requests are built in
- After each OpenAPI spec change, re-run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Replit cannot preview Electron in the iframe — verify via `pnpm run typecheck`; binaries must be built locally or via the GitHub Actions workflow
- electron-builder produces installers only for the host OS unless cross-toolchains (e.g. Wine) are available — use the CI workflow for full Mac+Win+Linux coverage
- Unsigned builds: macOS users may need `xattr -d com.apple.quarantine "<app>"`; Windows SmartScreen warns. Set `CSC_LINK`/`CSC_KEY_PASSWORD` to sign.

## Pointers

- `desktop/README.md` — full build, package, and signing instructions
- `.github/workflows/build-desktop.yml` — CI matrix for cross-platform installers
- See the `pnpm-workspace` skill for monorepo conventions
