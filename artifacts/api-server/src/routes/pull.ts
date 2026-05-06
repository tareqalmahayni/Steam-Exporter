import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  StartPullBody,
  CancelPullParams,
  GetPullStatusParams,
  DownloadPullParams,
} from "@workspace/api-zod";
import { pullAllStats, listGames, probeStats, type GameInfo } from "../lib/steamworks";
import { generateExcel } from "../lib/excel";
import { logger } from "../lib/logger";

const router = Router();

type JobStatus = "running" | "completed" | "cancelled" | "failed" | "session_expired";

interface ProgressInfo {
  gameIndex: number;
  totalGames: number;
  gameName: string;
  metric: string;
  estimatedSecondsRemaining?: number;
}

interface GameError {
  appId: number;
  gameName: string;
  error: string;
}

interface Job {
  status: JobStatus;
  progress?: ProgressInfo;
  errorMessage?: string;
  gameErrors: GameError[];
  excelBuffer?: Buffer;
  filename?: string;
  cancelled: boolean;
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
  appIds: number[];
  granularity: string;
}

const jobs = new Map<string, Job>();

setInterval(() => {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (
      job.status !== "running" &&
      (job as unknown as { createdAt?: number }).createdAt &&
      now - ((job as unknown as { createdAt: number }).createdAt) > TWO_HOURS
    ) {
      jobs.delete(id);
    }
  }
}, 60_000);

router.post("/pull/start", async (req, res): Promise<void> => {
  const parsed = StartPullBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure, appIds, granularity } = parsed.data;

  if (!appIds || appIds.length === 0) {
    res.status(400).json({ error: "no_games", message: "At least one game must be selected" });
    return;
  }

  const jobId = uuidv4();
  const job: Job & { createdAt: number } = {
    status: "running",
    gameErrors: [],
    cancelled: false,
    sessionid,
    steamLoginSecure,
    partnerSessionid,
    partnerSteamLoginSecure,
    appIds,
    granularity,
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);

  res.json({ jobId });

  setImmediate(async () => {
    try {
      let allGames: GameInfo[] = [];
      let skippedGames: GameInfo[] = [];
      try {
        const gamesResult = await listGames(sessionid, steamLoginSecure);
        allGames = gamesResult.games;
        skippedGames = gamesResult.skipped;
      } catch {
        allGames = appIds.map((id) => ({ appId: id, name: `App ${id}`, type: "game" }));
      }

      const selectedGames = appIds
        .map((id) => allGames.find((g) => g.appId === id) ?? { appId: id, name: `App ${id}`, type: "game" })
        .filter(Boolean) as GameInfo[];

      const statsResults = await pullAllStats(
        appIds,
        selectedGames,
        sessionid,
        steamLoginSecure,
        granularity,
        (progress) => {
          job.progress = progress;
        },
        () => job.cancelled,
        partnerSessionid,
        partnerSteamLoginSecure
      );

      // Log a summary of what was actually collected so we can diagnose empty data
      for (const s of statsResults) {
        logger.info(
          {
            appId: s.appId,
            gameName: s.gameName,
            wishlistRows: s.wishlistData?.length ?? 0,
            visitsRows: s.visitsData?.length ?? 0,
            trafficRows: s.trafficData?.length ?? 0,
            salesRows: s.salesData?.length ?? 0,
            followersRows: s.followersData?.length ?? 0,
            hasReviews: !!s.reviewsData,
            errors: s.errors,
          },
          "game stats collected"
        );
      }

      if (job.cancelled) {
        job.status = "cancelled";
        return;
      }

      const gameErrors: GameError[] = statsResults
        .filter((s) => s.errors.length > 0)
        .flatMap((s) =>
          s.errors.map((e) => ({ appId: s.appId, gameName: s.gameName, error: e }))
        );

      const date = new Date().toISOString().split("T")[0];
      const filename = `steamworks_pull_${date}_${granularity}.xlsx`;

      const buf = await generateExcel(
        statsResults,
        granularity,
        skippedGames,
        gameErrors
      );

      job.excelBuffer = buf;
      job.filename = filename;
      job.gameErrors = gameErrors;
      job.status = "completed";
    } catch (e) {
      const msg = (e as Error).message;
      logger.error({ err: e, jobId }, "Pull job failed");
      if (msg === "session_expired") {
        job.status = "session_expired";
        job.errorMessage = "Session expired — paste fresh cookies to continue";
      } else {
        job.status = "failed";
        job.errorMessage = msg;
      }
    }
  });
});

router.get("/pull/status/:jobId", (req, res): void => {
  const parsed = GetPullStatusParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const job = jobs.get(parsed.data.jobId);
  if (!job) {
    res.status(404).json({ error: "not_found", message: "Job not found" });
    return;
  }

  res.json({
    status: job.status,
    progress: job.progress,
    errorMessage: job.errorMessage,
    gameErrors: job.gameErrors,
  });
});

router.post("/pull/cancel/:jobId", (req, res): void => {
  const parsed = CancelPullParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const job = jobs.get(parsed.data.jobId);
  if (!job) {
    res.status(404).json({ error: "not_found", message: "Job not found" });
    return;
  }

  job.cancelled = true;
  res.json({ success: true, message: "Cancellation requested" });
});

router.get("/pull/download/:jobId", (req, res): void => {
  const parsed = DownloadPullParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const job = jobs.get(parsed.data.jobId);
  if (!job) {
    res.status(404).json({ error: "not_found", message: "Job not found" });
    return;
  }

  if (job.status !== "completed" || !job.excelBuffer) {
    res.status(404).json({ error: "not_ready", message: "Pull is not yet complete" });
    return;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${job.filename || "steamworks_pull.xlsx"}"`
  );
  res.send(job.excelBuffer);
});

// Diagnostic: probe all stat endpoints for one appId and return raw responses.
// POST /api/pull/probe  { sessionid, steamLoginSecure, appId, granularity }
router.post("/pull/probe", async (req, res): Promise<void> => {
  const { sessionid, steamLoginSecure, partnerSessionid, partnerSteamLoginSecure, appId, granularity } = req.body as {
    sessionid?: string;
    steamLoginSecure?: string;
    partnerSessionid?: string;
    partnerSteamLoginSecure?: string;
    appId?: number;
    granularity?: string;
  };

  if (!sessionid || !steamLoginSecure || !appId) {
    res.status(400).json({ error: "missing_params", message: "sessionid, steamLoginSecure, and appId are required" });
    return;
  }

  try {
    const results = await probeStats(Number(appId), sessionid, steamLoginSecure, granularity || "monthly", partnerSessionid, partnerSteamLoginSecure);
    res.json({ appId, granularity: granularity || "monthly", results });
  } catch (e) {
    req.log.error({ err: e }, "Stats probe failed");
    res.status(500).json({ error: "probe_failed", message: (e as Error).message });
  }
});

export default router;
