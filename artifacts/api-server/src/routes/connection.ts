import { Router } from "express";
import { TestConnectionBody } from "@workspace/api-zod";
import { testConnection, getRawHomeSnippet } from "../lib/steamworks";

const router = Router();

router.post("/connection/test", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure } = parsed.data;

  try {
    const result = await testConnection(sessionid, steamLoginSecure);
    res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "session_expired") {
      res.status(401).json({ error: "session_expired", message: "Cookies are invalid or expired. Re-copy them from DevTools." });
    } else {
      req.log.error({ err: e }, "Connection test failed");
      res.status(500).json({ error: "connection_failed", message: msg });
    }
  }
});

// Debug: returns the raw /home response so you can see exactly what Steam is sending back
router.post("/connection/debug", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure } = parsed.data;

  try {
    const raw = await getRawHomeSnippet(sessionid, steamLoginSecure);
    res.json(raw);
  } catch (e) {
    res.status(500).json({ error: "debug_failed", message: (e as Error).message });
  }
});

export default router;
