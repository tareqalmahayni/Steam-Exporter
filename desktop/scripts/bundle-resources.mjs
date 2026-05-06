// Copy api-server/dist and steamworks-exporter/dist into desktop/dist/{server,web}
// so electron-builder's extraResources can package them into the final app.
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(root);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(from, to, label) {
  if (!(await exists(from))) {
    throw new Error(`Missing ${label}: ${from} — did you run pnpm run build:server / build:web?`);
  }
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log(`copied ${label}: ${from} → ${to}`);
}

await copyDir(
  path.join(repo, "artifacts/api-server/dist"),
  path.join(root, "dist/server"),
  "api-server build"
);

// Vite emits to artifacts/steamworks-exporter/dist/public (see its vite.config.ts
// `build.outDir`). We copy that inner folder so desktop/dist/web/index.html
// sits at the root, which is what Express's static middleware + SPA fallback
// expects in the packaged app.
await copyDir(
  path.join(repo, "artifacts/steamworks-exporter/dist/public"),
  path.join(root, "dist/web"),
  "frontend build"
);

console.log("resources bundled");
