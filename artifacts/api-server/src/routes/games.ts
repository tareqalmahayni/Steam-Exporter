import { Router } from "express";
import { ListGamesBody, GetGameTotalsBody } from "@workspace/api-zod";
import { listGames, debugListGames, fetchGameTotals } from "../lib/steamworks";

const router = Router();

router.post("/games/totals", async (req, res): Promise<void> => {
  const parsed = GetGameTotalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const { sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure, appId } = parsed.data;
  try {
    const totals = await fetchGameTotals(appId, sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure);
    res.json({ appId, ...totals });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "session_expired") {
      res.status(401).json({ error: "session_expired", message: "Invalid or expired cookies" });
    } else {
      req.log.error({ err: e, appId }, "Game totals failed");
      res.status(500).json({ error: "totals_failed", message: msg });
    }
  }
});

router.post("/games/list", async (req, res): Promise<void> => {
  const parsed = ListGamesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure } = parsed.data;

  try {
    const result = await listGames(sessionid, steamLoginSecure);
    req.log.info({ gamesFound: result.games.length, skipped: result.skipped.length }, "Game list returned");
    res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "session_expired") {
      res.status(401).json({ error: "session_expired", message: "Invalid or expired cookies" });
    } else {
      req.log.error({ err: e }, "Game list failed");
      res.status(500).json({ error: "list_failed", message: msg });
    }
  }
});

// Debug endpoint — returns raw diagnostic data about each scraping strategy
router.post("/games/debug", async (req, res): Promise<void> => {
  const parsed = ListGamesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure } = parsed.data;

  try {
    const result = await debugListGames(sessionid, steamLoginSecure);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "debug_failed", message: (e as Error).message });
  }
});

export default router;
