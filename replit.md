# Steamworks Publisher Stats Exporter

A single-page web app that connects to your Steamworks publisher account using session cookies, pulls stats for each base game, and downloads a single Excel file with one tab per game.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies, see artifact.toml)
- `pnpm --filter @workspace/steamworks-exporter run dev` — run the frontend (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: none (no database — stateless per-session)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, shadcn/ui, Tailwind, TanStack Query, Wouter
- API: Express 5
- Scraping: cheerio + native fetch
- Excel: exceljs
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation
- `artifacts/steamworks-exporter/src/` — React frontend
  - `components/StepConnect.tsx` — Step 1: cookie input + connection test
  - `components/StepPickGames.tsx` — Step 2: game selection + range presets
  - `components/StepPull.tsx` — Step 3: pull with live progress + download
  - `components/TutorialPanel.tsx` — slide-over with DevTools cookie instructions
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/steamworks.ts` — Steamworks scraping module
- `artifacts/api-server/src/lib/excel.ts` — Excel generation with exceljs

## Architecture decisions

- **No database** — fully stateless. Pull jobs live in an in-memory Map on the API server (TTL: 2h). Tab close wipes sessionStorage.
- **Job polling** — frontend polls `/api/pull/status/:jobId` every 1s while running. No WebSocket or SSE needed.
- **Per-metric resilience** — each stat module (wishlists, visits, sales, etc.) catches errors independently; one failure doesn't kill the whole pull.
- **Cookies stay client-side** — sessionStorage only, cleared on tab close, never persisted to server DB.
- **Steamworks scraping** — HTML scraping via cheerio + JSON fallback endpoints. Each metric independently tries both methods.

## Product

- Step 1 — Paste `sessionid` + `steamLoginSecure` cookies, test connection (shows publisher name + game count)
- Step 2 — Check/uncheck games, pick granularity (Daily/Weekly/Monthly/Lifetime)
- Step 3 — Pull with live progress bar, cancel button, auto-download on completion, re-download button
- Built-in tutorial panel with browser-specific DevTools instructions for finding cookies

## User preferences

- No saved login, no scheduling, no charts — Excel is the deliverable
- Each metric is a separate independent module so a break in one doesn't kill others

## Gotchas

- Steam may change partner site HTML at any time — each metric module should be maintained independently
- Steam may rate-limit unusual traffic — 400-600ms polite delays between requests are built in
- Cookies expire roughly weekly — users re-paste to continue
- The `>>` character is invalid raw JSX text — must be escaped as `{">>"}`
- After each OpenAPI spec change, re-run codegen: `pnpm --filter @workspace/api-spec run codegen`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
