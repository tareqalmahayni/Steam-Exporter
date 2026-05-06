import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogIn, AlertTriangle } from "lucide-react";
import { StepPickGames } from "@/components/StepPickGames";
import { StepPull } from "@/components/StepPull";
import { useTestConnection, type PullRequestGranularity } from "@workspace/api-client-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Credentials = {
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
};

const EMPTY: Credentials = {
  sessionid: "",
  steamLoginSecure: "",
  partnerSessionid: "",
  partnerSteamLoginSecure: "",
};

function isFullCreds(c: Credentials): boolean {
  return !!(c.sessionid && c.steamLoginSecure && c.partnerSessionid && c.partnerSteamLoginSecure);
}

export function DesktopApp() {
  const [credentials, setCredentials] = useState<Credentials>(EMPTY);
  const [publisherName, setPublisherName] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGames, setSelectedGames] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<PullRequestGranularity>(
    "previous-month" as PullRequestGranularity
  );
  const [customStartIso, setCustomStartIso] = useState<string>("");
  const [customEndIso, setCustomEndIso] = useState<string>("");
  const [autoLoginChecked, setAutoLoginChecked] = useState(false);

  const testConn = useTestConnection({
    mutation: {
      onSuccess: (data) => {
        setPublisherName(data.publisherName);
        setLoginError(null);
        setStep(2);
      },
      onError: () => {
        setLoginError(
          "Steam accepted the login but we couldn't reach your publisher account. Please sign in again."
        );
        // Stored cookies are stale — wipe them so next launch shows the login screen cleanly.
        window.desktop?.clearStoredSteamCookies?.();
        setCredentials(EMPTY);
      },
    },
  });

  // On launch: try to reuse cookies from a prior session so the user can
  // skip the login screen entirely. testConnection acts as the validity check.
  const triedAutoLogin = useRef(false);
  useEffect(() => {
    if (triedAutoLogin.current || !window.desktop) {
      setAutoLoginChecked(true);
      return;
    }
    triedAutoLogin.current = true;
    (async () => {
      try {
        const stored = await window.desktop!.getStoredSteamCookies();
        if (stored && isFullCreds(stored)) {
          setCredentials(stored);
        }
      } finally {
        setAutoLoginChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (
      isFullCreds(credentials) &&
      !publisherName &&
      !testConn.isPending
    ) {
      testConn.mutate({ data: credentials });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  const handleLogin = async () => {
    if (!window.desktop) return;
    setLoginPending(true);
    setLoginError(null);
    try {
      const result = await window.desktop.loginToSteam();
      if ("cancelled" in result) {
        setLoginError("Login window was closed before sign-in completed.");
      } else if (!isFullCreds(result)) {
        setLoginError(
          "Signed in, but Steam didn't issue cookies for both partner.steamgames.com and partner.steampowered.com. Try opening both pages in the login window before closing it."
        );
      } else {
        setCredentials(result);
      }
    } catch (e) {
      setLoginError((e as Error).message ?? "Login failed");
    } finally {
      setLoginPending(false);
    }
  };

  const handleSignOut = async () => {
    setCredentials(EMPTY);
    setPublisherName(null);
    setSelectedGames([]);
    setStep(1);
    if (window.desktop?.clearStoredSteamCookies) {
      await window.desktop.clearStoredSteamCookies();
    }
  };

  const showAutoLoginSpinner = !autoLoginChecked || (testConn.isPending && step === 1 && !publisherName);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground font-sans">
      <header className="w-full border-b border-border bg-card py-4 px-6 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            Steamworks<span className="text-foreground">Exporter</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Desktop · Export your Steamworks publisher stats to Excel
          </p>
        </div>
        {publisherName && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Signed in as <span className="text-primary font-medium">{publisherName}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto py-10 px-4 md:px-6 flex flex-col">
        {step === 1 && (
          <Card className="w-full bg-card border-card-border shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {showAutoLoginSpinner ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <LogIn className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">
                  {showAutoLoginSpinner ? "Restoring your session…" : "Sign in to Steamworks"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  {showAutoLoginSpinner
                    ? "Checking for a saved Steam session from your last visit."
                    : "A Steam login window will open. Sign in with your usual publisher account (including 2FA). The app reads the session cookies locally — nothing is sent to any third-party server. Your session is remembered for next time."}
                </p>
              </div>
              {!showAutoLoginSpinner && (
                <Button
                  size="lg"
                  onClick={handleLogin}
                  disabled={loginPending || testConn.isPending}
                  className="min-w-[220px]"
                  data-testid="button-open-steam-login"
                >
                  {loginPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for sign-in…
                    </>
                  ) : testConn.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" /> Open Steam login
                    </>
                  )}
                </Button>
              )}
              {loginError && !showAutoLoginSpinner && (
                <Alert className="max-w-md text-left border-destructive/40 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="ml-2 text-sm text-destructive">
                    {loginError}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <StepPickGames
              credentials={credentials}
              selectedGames={selectedGames}
              setSelectedGames={setSelectedGames}
              granularity={granularity}
              setGranularity={setGranularity}
              customStartIso={customStartIso}
              setCustomStartIso={setCustomStartIso}
              customEndIso={customEndIso}
              setCustomEndIso={setCustomEndIso}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(3)}
                disabled={
                  selectedGames.length === 0 ||
                  (granularity === ("custom" as PullRequestGranularity) &&
                    (!customStartIso || !customEndIso || customStartIso > customEndIso))
                }
                data-testid="button-next-pull"
              >
                Next — Pull data &rarr;
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <StepPull
              credentials={credentials}
              selectedGames={selectedGames}
              granularity={granularity}
              customStartIso={customStartIso}
              customEndIso={customEndIso}
              onReset={handleSignOut}
            />
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(2)}>
                &larr; Back
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
