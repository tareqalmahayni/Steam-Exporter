import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, AlertCircle, FileDown, RefreshCw, XCircle, LogIn, ShieldCheck, Loader2 } from "lucide-react";
import {
  useStartPull,
  useGetPullStatus,
  getGetPullStatusQueryKey,
  useCancelPull,
  usePreflightConnection,
  type PullRequestGranularity
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Mirror of server getDateRangeIso for granularities the user can pick.
 * Used so the header + preview can show "May 4 → May 10" instead of just
 * the granularity name. Keep in sync with artifacts/api-server/src/lib/steamworks.ts.
 */
function computeDateRange(
  granularity: PullRequestGranularity,
  customStartIso?: string,
  customEndIso?: string,
): { startIso: string; endIso: string } {
  if (granularity === ("custom" as PullRequestGranularity) && customStartIso && customEndIso) {
    return { startIso: customStartIso, endIso: customEndIso };
  }
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let start = new Date(now);
  let end = new Date(now);
  const g = granularity as string;
  if (g === "weekly") start.setDate(now.getDate() - 7);
  else if (g === "monthly") start.setDate(now.getDate() - 30);
  else if (g === "yearly" || g === "previous-year") {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else if (g === "previous-month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (g === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (g === "preference" || g === "previous-week") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else if (g === "lifetime") {
    start.setFullYear(2003, 0, 1);
  }
  return { startIso: fmt(start), endIso: fmt(end) };
}

function formatRangeHuman(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, opts);
  return startIso === endIso ? fmt(startIso) : `${fmt(startIso)} → ${fmt(endIso)}`;
}

interface StepPullProps {
  credentials: { sessionid: string; steamLoginSecure: string; partnerSessionid: string; partnerSteamLoginSecure: string };
  selectedGames: number[];
  granularity: PullRequestGranularity;
  customStartIso?: string;
  customEndIso?: string;
  onReset: () => void;
}

export function StepPull({ credentials, selectedGames, granularity, customStartIso, customEndIso, onReset }: StepPullProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [preflightError, setPreflightError] = useState<{
    status: string;
    message: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const computedRange = computeDateRange(granularity, customStartIso, customEndIso);
  const humanRange = formatRangeHuman(computedRange.startIso, computedRange.endIso);

  const startPull = useStartPull({
    mutation: {
      onSuccess: (data) => {
        setJobId(data.jobId);
      }
    }
  });

  const preflight = usePreflightConnection();
  const cancelPull = useCancelPull();

  const { data: statusData } = useGetPullStatus(jobId || "", {
    query: {
      enabled: !!jobId,
      refetchInterval: (data: any) => {
        if (!data) return 1000;
        return ['completed', 'failed', 'cancelled', 'session_expired'].includes(data.status) ? false : 1000;
      },
      queryKey: getGetPullStatusQueryKey(jobId || "")
    }
  });

  // Auto-download on complete
  useEffect(() => {
    if (statusData?.status === 'completed' && jobId) {
      window.location.href = `${import.meta.env.BASE_URL}api/pull/download/${jobId}`;
    }
  }, [statusData?.status, jobId]);

  const handleStart = async () => {
    if (jobId) {
      setJobId(null);
      queryClient.removeQueries({ queryKey: getGetPullStatusQueryKey(jobId) });
    }
    setPreflightError(null);

    // PREFLIGHT — validate session against the actual per-game traffic page
    // before we kick off a long pull job. Surfaces:
    //   STEAMWORKS_LOGIN_REQUIRED / STEAMWORKS_SESSION_EXPIRED / TRAFFIC_PAGE_ACCESS_DENIED
    if (selectedGames.length === 0) return;
    try {
      const result = await preflight.mutateAsync({
        data: { ...credentials, appId: selectedGames[0]! },
      });
      if (!result.ok) {
        setPreflightError({
          status: result.status,
          message: result.message || "Steamworks session check failed.",
        });
        return;
      }
    } catch (e) {
      setPreflightError({
        status: "TRAFFIC_DOWNLOAD_FAILED",
        message: (e as Error).message || "Could not validate session.",
      });
      return;
    }

    startPull.mutate({
      data: {
        ...credentials,
        appIds: selectedGames,
        granularity,
        ...(granularity === ("custom" as PullRequestGranularity) && customStartIso && customEndIso
          ? { customStartIso, customEndIso }
          : {}),
      }
    });
  };

  const handleCancel = () => {
    if (jobId) {
      cancelPull.mutate({ jobId });
    }
  };

  const handleDownloadAgain = () => {
    if (jobId && statusData?.status === 'completed') {
      window.location.href = `${import.meta.env.BASE_URL}api/pull/download/${jobId}`;
    }
  };

  const isRunning = statusData?.status === 'running' || startPull.isPending;
  const isCompleted = statusData?.status === 'completed';
  const isFailed = statusData?.status === 'failed';
  const isSessionExpired = statusData?.status === 'session_expired';
  const isCancelled = statusData?.status === 'cancelled';

  const progressObj = statusData?.progress;
  const progressPercent = progressObj && progressObj.totalGames > 0
    ? ((progressObj.gameIndex) / progressObj.totalGames) * 100
    : 0;

  return (
    <Card className="w-full bg-card border-card-border shadow-lg animate-in fade-in slide-in-from-bottom-4">
      <CardHeader>
        <CardTitle className="text-xl">3. Export Data</CardTitle>
        <CardDescription data-testid="text-pull-summary">
          Pulling <span className="font-semibold text-foreground">{selectedGames.length}</span>{" "}
          game{selectedGames.length === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-foreground">{humanRange}</span>{" "}
          <span className="text-muted-foreground/70">
            ({computedRange.startIso} → {computedRange.endIso})
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {!jobId || isCancelled ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <Button
              size="lg"
              className="w-full max-w-sm h-14 text-lg font-bold"
              onClick={handleStart}
              disabled={selectedGames.length === 0 || preflight.isPending}
              data-testid="button-pull-start"
            >
              {preflight.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Validating Steamworks session…</>
              ) : (
                <><Download className="mr-2 h-5 w-5" /> Pull Data to Excel</>
              )}
            </Button>
            {selectedGames.length === 0 && (
              <p className="text-sm text-muted-foreground">Select at least one game to pull data.</p>
            )}
            {isCancelled && (
              <p className="text-sm text-muted-foreground">Pull was cancelled. You can start again.</p>
            )}
            {preflightError && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive max-w-md text-left" data-testid="alert-preflight-failed">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-mono text-xs">{preflightError.status}</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <p className="text-sm">{preflightError.message}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/30 hover:bg-destructive/20 text-destructive"
                    onClick={onReset}
                    data-testid="button-preflight-reauth"
                  >
                    <LogIn className="mr-2 h-4 w-4" /> Sign in to Steam again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!preflightError && !preflight.isPending && selectedGames.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Session will be validated against {selectedGames.length === 1 ? "your" : "the first"} game's stats page before the pull starts.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            
            {isRunning && (
              <div className="space-y-3">
                <div className="flex justify-between items-end text-sm">
                  <span className="font-medium">
                    {progressObj ? (
                      `Pulling ${progressObj.gameIndex + 1} of ${progressObj.totalGames} — ${progressObj.gameName} · ${progressObj.metric}`
                    ) : (
                      "Initializing..."
                    )}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {progressObj?.estimatedSecondsRemaining ? `${Math.ceil(progressObj.estimatedSecondsRemaining)}s left` : ''}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={cancelPull.isPending} className="text-muted-foreground hover:text-destructive">
                    <XCircle className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileDown className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Export Complete</h3>
                  <p className="text-sm text-muted-foreground">Your Excel file should download automatically.</p>
                  {statusData.gameErrors && statusData.gameErrors.length > 0 && (
                    <p className="text-sm text-destructive mt-2">
                      Completed with {statusData.gameErrors.length} errors. See summary below.
                    </p>
                  )}
                </div>
                <div className="flex space-x-4">
                  <Button variant="outline" onClick={handleDownloadAgain}>
                    <Download className="mr-2 h-4 w-4" /> Download Again
                  </Button>
                  <Button variant="secondary" onClick={handleStart}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Pull Fresh
                  </Button>
                </div>
              </div>
            )}

            {isSessionExpired && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive" data-testid="alert-session-expired">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-mono text-xs">STEAMWORKS_SESSION_EXPIRED</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col space-y-3">
                  <p>
                    Your Steam session expired during the pull
                    {progressObj
                      ? ` (failed at game ${progressObj.gameIndex + 1} of ${progressObj.totalGames}: ${progressObj.gameName})`
                      : ""}
                    . Re-sign in to Steam, then return here and click Pull Fresh — your game selection and date range are preserved.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 hover:bg-destructive/20 text-destructive"
                      onClick={onReset}
                      data-testid="button-sign-in-again"
                    >
                      <LogIn className="mr-2 h-4 w-4" /> Sign in to Steam again
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 hover:bg-destructive/20 text-destructive"
                      onClick={handleStart}
                      data-testid="button-retry-after-reauth"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Retry pull
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {isFailed && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Export Failed</AlertTitle>
                <AlertDescription className="mt-2">
                  {statusData.errorMessage || "An unknown error occurred during the pull process."}
                  <Button size="sm" variant="outline" className="mt-4 border-destructive/30 hover:bg-destructive/20 text-destructive w-full" onClick={handleStart}>
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {statusData?.gameErrors && statusData.gameErrors.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-destructive mb-3">Errors Encountered</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {statusData.gameErrors.map((err, idx) => (
                    <div key={idx} className="text-xs bg-destructive/5 border border-destructive/20 p-2 rounded-md">
                      <span className="font-semibold">{err.gameName}</span>: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
