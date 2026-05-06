# Steamworks Exporter — Desktop App

Electron wrapper that bundles the existing API server + React UI into a
downloadable installer for Mac, Windows, and Linux. Sign-in happens in an
embedded browser window so Steam sees your real IP (no cookie pasting, no
bookmarklet, no data-center IP issues).

## How it works

1. `main.cjs` (Electron main process) spawns the bundled API server as a child
   process on a random local port. The server is the same Express app that
   runs on the web — see `artifacts/api-server`.
2. The server also serves the built React UI when the `FRONTEND_DIR` env var
   is set (it is, in the desktop build).
3. The main `BrowserWindow` loads `http://127.0.0.1:<port>/` and the React UI
   talks to `/api/...` on the same origin.
4. When the user clicks **Sign in to Steam**, Electron opens a second
   `BrowserWindow` pointing at `partner.steamgames.com`. After login,
   Electron reads the session cookies for both Steam domains and hands them
   to the renderer via the `window.desktop` preload bridge. The renderer then
   uses them with the existing `/api/connection/test`, `/api/games/list`,
   `/api/pull/*` endpoints — no protocol changes.

## Build locally

```bash
# from the repo root
pnpm install
pnpm --filter @workspace/desktop run build      # builds server, web, main
pnpm --filter @workspace/desktop run start      # opens the app

# Produce platform installers (uses electron-builder)
pnpm --filter @workspace/desktop run package         # current platform
pnpm --filter @workspace/desktop run package:mac     # .dmg + .zip
pnpm --filter @workspace/desktop run package:win     # .exe NSIS + portable
pnpm --filter @workspace/desktop run package:linux   # .AppImage + .deb
```

Output appears under `desktop/release/`.

> **Cross-platform note:** electron-builder can only produce a Mac `.dmg` on
> macOS, and a Windows `.exe` requires Wine on Linux/Mac. The simplest way to
> get installers for every platform is GitHub Actions — see
> `.github/workflows/build-desktop.yml`.

## CI builds

Push a tag like `v0.1.0` (or trigger the workflow manually from the Actions
tab) and GitHub Actions will run the build on macOS, Windows, and Linux
runners and upload installers as workflow artifacts.

## Code signing

Out of the box the app is **unsigned**:

- macOS users will need to right-click → Open the first time, or run
  `xattr -d com.apple.quarantine "/Applications/Steamworks Exporter.app"`.
- Windows SmartScreen will warn; click "More info → Run anyway".

To sign properly, set the standard electron-builder env vars (`CSC_LINK`,
`CSC_KEY_PASSWORD` for mac/win) before running `package`.
