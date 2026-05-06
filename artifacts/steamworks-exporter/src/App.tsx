import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { StepConnect } from "@/components/StepConnect";
import { StepPickGames } from "@/components/StepPickGames";
import { StepPull } from "@/components/StepPull";
import { type PullRequestGranularity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function buildBookmarkletHref(origin: string): string {
  const loader =
    "(function(){var s=document.createElement('script');s.src='" +
    origin +
    "/api/bookmarklet.js?t='+Date.now();document.body.appendChild(s);})();";
  return "javascript:" + encodeURI(loader);
}

function BookmarkletInstall({ onUseLegacy }: { onUseLegacy: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const href = buildBookmarkletHref(origin);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            Install the Steamworks Exporter bookmark
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            One-time setup. After this, you can export stats with two clicks
            and never have to paste cookies again.
          </p>
        </div>

        <div className="rounded-md bg-muted/30 border border-border p-4">
          <p className="text-sm font-medium mb-3">Step 1 — Drag this to your bookmarks bar:</p>
          <a
            href={href}
            onClick={(e) => e.preventDefault()}
            draggable
            className="inline-block rounded-md bg-primary text-primary-foreground px-5 py-2.5 font-semibold text-sm shadow hover:bg-primary/90 cursor-grab active:cursor-grabbing"
          >
            Steamworks Exporter
          </a>
          <p className="text-xs text-muted-foreground mt-3">
            If you don&apos;t see your bookmarks bar, press{" "}
            <kbd className="px-1 py-0.5 bg-background border border-border rounded text-xs">
              Ctrl/Cmd + Shift + B
            </kbd>{" "}
            to show it. Then drag the button above onto it.
          </p>
        </div>

        <div className="rounded-md bg-muted/30 border border-border p-4 space-y-2">
          <p className="text-sm font-medium">Step 2 — Use it</p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside ml-1">
            <li>
              Make sure you&apos;re logged in to Steamworks in your browser.
            </li>
            <li>
              Open{" "}
              <a
                href="https://partner.steamgames.com/home"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                partner.steamgames.com
              </a>{" "}
              and click the bookmark.
            </li>
            <li>
              When prompted, open{" "}
              <a
                href="https://partner.steampowered.com/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                partner.steampowered.com
              </a>{" "}
              and click the bookmark again.
            </li>
            <li>Your Excel file downloads automatically.</li>
          </ol>
        </div>

        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong>Why this works:</strong> the bookmark runs inside your
            already-logged-in Steamworks tab, using your real session. No
            cookies leave your browser. Only the parsed page HTML is sent to
            the server to build your Excel file.
          </p>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onUseLegacy}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Having trouble? Use the legacy cookie-paste flow instead.
        </button>
      </div>
    </div>
  );
}

function LegacyCookieFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<number>(1);
  const [credentials, setCredentials] = useState({
    sessionid: "",
    steamLoginSecure: "",
    partnerSessionid: "",
    partnerSteamLoginSecure: "",
  });
  const [publisherName, setPublisherName] = useState<string | null>(null);
  const [selectedGames, setSelectedGames] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<PullRequestGranularity>("monthly");

  useEffect(() => {
    const savedSessionId = sessionStorage.getItem("steam_sessionid");
    const savedLoginSecure = sessionStorage.getItem("steam_login_secure");
    const savedPartnerSessionId = sessionStorage.getItem("steam_partner_sessionid");
    const savedPartnerLoginSecure = sessionStorage.getItem("steam_partner_login_secure");
    if (savedSessionId && savedLoginSecure) {
      setCredentials({
        sessionid: savedSessionId,
        steamLoginSecure: savedLoginSecure,
        partnerSessionid: savedPartnerSessionId || "",
        partnerSteamLoginSecure: savedPartnerLoginSecure || "",
      });
    }
  }, []);

  const handleConnectSuccess = (name: string, _count: number) => {
    setPublisherName(name);
    sessionStorage.setItem("steam_sessionid", credentials.sessionid);
    sessionStorage.setItem("steam_login_secure", credentials.steamLoginSecure);
    sessionStorage.setItem("steam_partner_sessionid", credentials.partnerSessionid);
    sessionStorage.setItem("steam_partner_login_secure", credentials.partnerSteamLoginSecure);
  };

  const handleReset = () => {
    setStep(1);
    setPublisherName(null);
    setSelectedGames([]);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground underline hover:text-foreground"
      >
        &larr; Back to bookmarklet (recommended)
      </button>

      <div className="w-full flex items-center justify-between mb-4 px-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex flex-col items-center space-y-2 ${step >= s ? "opacity-100" : "opacity-40"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step === s
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(102,192,244,0.3)]"
                  : step > s
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            <span className="text-xs font-medium uppercase tracking-wider hidden sm:block">
              {s === 1 ? "Connect" : s === 2 ? "Configure" : "Export"}
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <StepConnect
            credentials={credentials}
            setCredentials={setCredentials}
            onSuccess={(name, count) => {
              handleConnectSuccess(name, count);
              setTimeout(() => setStep(2), 600);
            }}
          />
          {publisherName && (
            <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2">
              <Button onClick={() => setStep(2)} className="w-full sm:w-auto">
                Continue to Configuration &rarr;
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <StepPickGames
            credentials={credentials}
            selectedGames={selectedGames}
            setSelectedGames={setSelectedGames}
            granularity={granularity}
            setGranularity={setGranularity}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              &larr; Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={selectedGames.length === 0}
              className="w-full sm:w-auto ml-4"
            >
              Continue to Export &rarr;
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
            onReset={handleReset}
          />
          <div className="flex justify-start">
            <Button variant="outline" onClick={() => setStep(2)}>
              &larr; Back to Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const [mode, setMode] = useState<"bookmarklet" | "legacy">("bookmarklet");

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground font-sans">
      <header className="w-full border-b border-border bg-card py-4 px-6 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            Steamworks<span className="text-foreground">Exporter</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export publisher stats to Excel — no cookies, no logins
          </p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto py-10 px-4 md:px-6 flex flex-col">
        {mode === "bookmarklet" ? (
          <BookmarkletInstall onUseLegacy={() => setMode("legacy")} />
        ) : (
          <LegacyCookieFlow onBack={() => setMode("bookmarklet")} />
        )}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
