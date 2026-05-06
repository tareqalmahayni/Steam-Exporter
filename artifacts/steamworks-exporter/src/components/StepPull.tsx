import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, AlertCircle, FileDown, RefreshCw, XCircle } from "lucide-react";
import { 
  useStartPull, 
  useGetPullStatus, 
  getGetPullStatusQueryKey, 
  useCancelPull,
  type PullRequestGranularity
} from "@workspace/api-client-react";
import { TutorialPanel } from "./TutorialPanel";
import { useQueryClient } from "@tanstack/react-query";

interface StepPullProps {
  credentials: { sessionid: string; steamLoginSecure: string; partnerSessionid: string; partnerSteamLoginSecure: string };
  selectedGames: number[];
  granularity: PullRequestGranularity;
  onReset: () => void;
}

export function StepPull({ credentials, selectedGames, granularity, onReset }: StepPullProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const startPull = useStartPull({
    mutation: {
      onSuccess: (data) => {
        setJobId(data.jobId);
      }
    }
  });

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

  const handleStart = () => {
    if (jobId) {
      setJobId(null);
      queryClient.removeQueries({ queryKey: getGetPullStatusQueryKey(jobId) });
    }
    startPull.mutate({
      data: {
        ...credentials,
        appIds: selectedGames,
        granularity
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
        <CardDescription>Pulling {selectedGames.length} games at {granularity} granularity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {!jobId || isCancelled ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <Button size="lg" className="w-full max-w-sm h-14 text-lg font-bold" onClick={handleStart} disabled={selectedGames.length === 0}>
              <Download className="mr-2 h-5 w-5" />
              Pull Data to Excel
            </Button>
            {selectedGames.length === 0 && (
              <p className="text-sm text-muted-foreground">Select at least one game to pull data.</p>
            )}
            {isCancelled && (
              <p className="text-sm text-muted-foreground">Pull was cancelled. You can start again.</p>
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
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Session Expired</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col space-y-3">
                  <p>Your Steam cookies have expired mid-pull.</p>
                  <div className="flex space-x-3">
                    <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/20 text-destructive" onClick={onReset}>
                      Paste Fresh Cookies
                    </Button>
                    <TutorialPanel>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/80">
                        Help me find them
                      </Button>
                    </TutorialPanel>
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
