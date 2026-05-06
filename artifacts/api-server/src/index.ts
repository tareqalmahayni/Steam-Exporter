import express from "express";
import path from "node:path";
import fs from "node:fs";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

// PORT=0 means "pick any free port" (used by the desktop wrapper).
if (Number.isNaN(port) || port < 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// When packaged inside the Electron desktop app, FRONTEND_DIR points at the
// built React assets so the same Express server serves /api/* AND /. This
// keeps the renderer on a single origin and avoids any CORS or asset-routing
// gymnastics inside the BrowserWindow.
const frontendDir = process.env["FRONTEND_DIR"];
if (frontendDir && fs.existsSync(frontendDir)) {
  logger.info({ frontendDir }, "Serving static frontend");
  app.use(express.static(frontendDir));
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    const indexHtml = path.join(frontendDir, "index.html");
    if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
    else next();
  });
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  logger.info({ port: actualPort }, "Server listening");
  // Sentinel line consumed by the Electron main process to learn the bound
  // port when PORT=0 was passed. Plain stdout, single line.
  process.stdout.write(`LISTENING_ON_PORT=${actualPort}\n`);
});
