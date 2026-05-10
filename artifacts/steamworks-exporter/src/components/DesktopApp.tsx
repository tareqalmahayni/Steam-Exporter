import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, AlertTriangle, ExternalLink } from "lucide-react";
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

// "Usable" = the steamgames pair is present. The backend's testConnection
// + fetchPartnerHtml replicate the JWT-refresh hop server-side, so the
// partner.steampowered.com pair is optional — requiring all four was the
// original cause of the "Waiting for sign-in…" hang the user reported.
function hasUsableCreds(c: Credentials): boolean {
  return !!(c.sessionid && c.steamLoginSecure);
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
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [manualCreds, setManualCreds] = useState<Credentials>(EMPTY);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

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
        if (stored && hasUsableCreds(stored)) {
          setCredentials(stored);
        }
      } finally {
        setAutoLoginChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (
      hasUsableCreds(credentials) &&
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
        setLoginError(
          "Login window was closed before sign-in was auto-detected. If you actually signed in, click \"I'm signed in, validate session\" below."
        );
      } else if (!hasUsableCreds(result)) {
        setLoginError(
          "Steam didn't issue session cookies. Sign in again, or use \"I'm signed in, validate session\" if the dashboard is visible."
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

  // Manual escape hatch: user reports the login window shows the Steamworks
  // dashboard but the main app still says "Waiting for sign-in…". Calls the
  // authoritative validator (cookie read + dashboard-HTML fetch through the
  // persistent partition). If the dashboard fetch returns authenticated HTML
  // we accept the session even when the cookie listener missed steamLoginSecure
  // (HttpOnly cookies set during the federated-login bounces).
  type ValidateChecks = {
    sessionidPresent: boolean;
    steamLoginSecurePresent: boolean;
    dashboardHtmlAuthenticated: boolean;
    dashboardReachable: boolean;
    dashboardStatus?: number;
    dashboardFinalUrl?: string;
  };
  const [validatePending, setValidatePending] = useState(false);
  const [validateChecks, setValidateChecks] = useState<ValidateChecks | null>(null);
  const handleValidateSession = async () => {
    if (!window.desktop) return;
    setValidatePending(true);
    setLoginError(null);
    setValidateChecks(null);
    try {
      const result = await window.desktop.validateSteamSession();
      setValidateChecks(result.checks);
      if (!result.ok || !result.credentials) {
        setLoginError(
          "STEAMWORKS_SESSION_DETECTION_FAILED — the embedded Steamworks dashboard is not currently authenticated. Click \"Open Steam login\" and finish signing in (including 2FA). Diagnostic checks below."
        );
        return;
      }
      // Dashboard validated — accept and let testConn confirm via backend.
      if (result.publisherName && !publisherName) {
        // Optimistically display the publisher name while testConn runs.
        // testConn's success handler will overwrite if backend disagrees.
        setPublisherName(result.publisherName);
      }
      setCredentials(result.credentials);
    } catch (e) {
      setLoginError((e as Error).message ?? "Validation failed");
    } finally {
      setValidatePending(false);
    }
  };

  const handleSignOut = async () => {
    setCredentials(EMPTY);
    setPublisherName(null);
    setSelectedGames([]);
    setStep(1);
    setFallbackOpen(false);
    setManualCreds(EMPTY);
    setManualError(null);
    if (window.desktop?.clearStoredSteamCookies) {
      await window.desktop.clearStoredSteamCookies();
    }
  };

  const handleOpenInBrowser = async () => {
    setManualError(null);
    setFallbackOpen(true);
    if (window.desktop?.openSteamLoginInBrowser) {
      try {
        await window.desktop.openSteamLoginInBrowser();
      } catch (e) {
        setManualError((e as Error).message);
      }
    }
  };

  const handleManualSubmit = async () => {
    setManualError(null);
    if (!isFullCreds(manualCreds)) {
      setManualError("All four cookie values are required.");
      return;
    }
    setManualSubmitting(true);
    try {
      if (window.desktop?.saveSteamCookies) {
        const res = await window.desktop.saveSteamCookies(manualCreds);
        if (!res.ok) {
          setManualError(res.error || "Could not save cookies.");
          return;
        }
        setCredentials(res.credentials ?? manualCreds);
      } else {
        setCredentials(manualCreds);
      }
      setFallbackOpen(false);
      setManualCreds(EMPTY);
    } finally {
      setManualSubmitting(false);
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
                    <div>{loginError}</div>
                    {validateChecks && (
                      <ul className="mt-2 space-y-0.5 text-xs font-mono">
                        <li>
                          {validateChecks.sessionidPresent ? "✓" : "✗"} sessionid present
                        </li>
                        <li>
                          {validateChecks.steamLoginSecurePresent ? "✓" : "✗"} steamLoginSecure present
                        </li>
                        <li>
                          {validateChecks.dashboardReachable ? "✓" : "✗"} dashboard reachable
                          {validateChecks.dashboardStatus ? ` (HTTP ${validateChecks.dashboardStatus})` : ""}
                        </li>
                        <li>
                          {validateChecks.dashboardHtmlAuthenticated ? "✓" : "✗"} dashboard HTML authenticated
                        </li>
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {!showAutoLoginSpinner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidateSession}
                  disabled={validatePending || testConn.isPending || loginPending}
                  className="min-w-[260px]"
                  data-testid="button-validate-session"
                >
                  {validatePending || testConn.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating session…
                    </>
                  ) : (
                    "I'm signed in, validate session"
                  )}
                </Button>
              )}

              {!showAutoLoginSpinner && !fallbackOpen && (
                <button
                  type="button"
                  onClick={handleOpenInBrowser}
                  className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4"
                  data-testid="link-browser-fallback"
                >
                  Trouble signing in? Use your default browser instead
                </button>
              )}

              {fallbackOpen && (
                <div className="w-full max-w-xl text-left rounded-md border border-border bg-background/40 p-5 space-y-4" data-testid="panel-browser-fallback">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-primary" /> Sign in via your browser
                    </h3>
                    <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Your browser just opened to <span className="font-mono text-foreground">partner.steamgames.com</span>. Sign in there (including 2FA).</li>
                      <li>Open DevTools (<span className="font-mono">F12</span>) → Application → Cookies → <span className="font-mono">https://partner.steamgames.com</span>. Copy the <span className="font-mono">sessionid</span> and <span className="font-mono">steamLoginSecure</span> values into the first two fields below.</li>
                      <li><b>Now visit <span className="font-mono">https://partner.steampowered.com/home</span> in the same browser tab.</b> This is required — it forces Steam to issue a separate cookie pair for that domain. The exporter pulls per-game stats from <span className="font-mono">partner.steampowered.com</span>, so without these the Excel will be empty.</li>
                      <li>Open DevTools again on the new page → <span className="font-mono">https://partner.steampowered.com</span> → copy <span className="font-mono">sessionid</span> and <span className="font-mono">steamLoginSecure</span> into the last two fields below.</li>
                    </ol>
                    <Alert className="border-amber-500/40 bg-amber-500/10 mt-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="ml-2 text-xs text-amber-200">
                        Pasting the same value into all four fields, or skipping the partner.steampowered.com step, will let you proceed but the exported Excel will show "Could not access stats page" for every game. Use the embedded sign-in button above whenever possible — it handles all of this automatically.
                      </AlertDescription>
                    </Alert>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <ManualField
                      label="sessionid (partner.steamgames.com)"
                      testId="input-manual-sessionid"
                      value={manualCreds.sessionid}
                      onChange={(v) => setManualCreds((c) => ({ ...c, sessionid: v }))}
                    />
                    <ManualField
                      label="steamLoginSecure (partner.steamgames.com)"
                      testId="input-manual-steamloginsecure"
                      value={manualCreds.steamLoginSecure}
                      onChange={(v) => setManualCreds((c) => ({ ...c, steamLoginSecure: v }))}
                    />
                    <ManualField
                      label="sessionid (partner.steampowered.com)"
                      testId="input-manual-partner-sessionid"
                      value={manualCreds.partnerSessionid}
                      onChange={(v) => setManualCreds((c) => ({ ...c, partnerSessionid: v }))}
                    />
                    <ManualField
                      label="steamLoginSecure (partner.steampowered.com)"
                      testId="input-manual-partner-steamloginsecure"
                      value={manualCreds.partnerSteamLoginSecure}
                      onChange={(v) => setManualCreds((c) => ({ ...c, partnerSteamLoginSecure: v }))}
                    />
                  </div>
                  {manualError && (
                    <p className="text-xs text-destructive">{manualError}</p>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFallbackOpen(false);
                        setManualCreds(EMPTY);
                        setManualError(null);
                      }}
                      disabled={manualSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleManualSubmit}
                      disabled={manualSubmitting || !isFullCreds(manualCreds)}
                      data-testid="button-manual-submit"
                    >
                      {manualSubmitting ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…</>
                      ) : (
                        "Continue"
                      )}
                    </Button>
                  </div>
                </div>
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

function ManualField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste value here"
        className="font-mono text-xs h-8 bg-background"
        data-testid={testId}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
