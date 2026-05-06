// Bundle the Electron main + preload TypeScript files to CommonJS .cjs files
// Electron's main process loads CJS by default so this is the simplest setup.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const common = {
  platform: "node",
  bundle: true,
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [path.join(root, "src/main.ts")],
  outfile: path.join(dist, "main.cjs"),
});

await build({
  ...common,
  entryPoints: [path.join(root, "src/preload.ts")],
  outfile: path.join(dist, "preload.cjs"),
});

console.log("main + preload built");
