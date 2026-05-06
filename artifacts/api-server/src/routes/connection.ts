import { Router } from "express";
import {
  TestConnectionBody,
} from "@workspace/api-zod";
import { testConnection } from "../lib/steamworks";

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
      res.status(401).json({ error: "session_expired", message: "Invalid or expired cookies" });
    } else {
      req.log.error({ err: e }, "Connection test failed");
      res.status(500).json({ error: "connection_failed", message: msg });
    }
  }
});

export default router;
