import { Router } from "express";
import { ListGamesBody } from "@workspace/api-zod";
import { listGames } from "../lib/steamworks";

const router = Router();

router.post("/games/list", async (req, res): Promise<void> => {
  const parsed = ListGamesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure } = parsed.data;

  try {
    const result = await listGames(sessionid, steamLoginSecure);
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

export default router;
