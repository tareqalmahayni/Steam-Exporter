import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { StepConnect } from "@/components/StepConnect";
import { StepPickGames } from "@/components/StepPickGames";
import { StepPull } from "@/components/StepPull";
import { type PullRequestGranularity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function StepperApp() {
  const [step, setStep] = useState<number>(1);
  const [credentials, setCredentials] = useState({ sessionid: "", steamLoginSecure: "" });
  const [publisherName, setPublisherName] = useState<string | null>(null);
  
  const [selectedGames, setSelectedGames] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<PullRequestGranularity>("monthly");

  // Load credentials from session storage on mount
  useEffect(() => {
    const savedSessionId = sessionStorage.getItem("steam_sessionid");
    const savedLoginSecure = sessionStorage.getItem("steam_login_secure");
    if (savedSessionId && savedLoginSecure) {
      setCredentials({ sessionid: savedSessionId, steamLoginSecure: savedLoginSecure });
    }
  }, []);

  const handleConnectSuccess = (name: string, count: number) => {
    setPublisherName(name);
    sessionStorage.setItem("steam_sessionid", credentials.sessionid);
    sessionStorage.setItem("steam_login_secure", credentials.steamLoginSecure);
  };

  const handleReset = () => {
    setStep(1);
    setPublisherName(null);
    setSelectedGames([]);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground font-sans">
      <header className="w-full border-b border-border bg-card py-4 px-6 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            Steamworks<span className="text-foreground">Exporter</span>
          </h1>
          {publisherName && (
            <p className="text-xs text-muted-foreground mt-0.5">Connected as {publisherName}</p>
          )}
        </div>
        {publisherName && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            Disconnect
          </Button>
        )}
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto py-10 px-4 md:px-6 flex flex-col space-y-8">
        
        {/* Progress Line */}
        <div className="w-full flex items-center justify-between mb-4 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex flex-col items-center space-y-2 ${step >= s ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(102,192,244,0.3)]' : step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {s}
              </div>
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:block">
                {s === 1 ? 'Connect' : s === 2 ? 'Configure' : 'Export'}
              </span>
            </div>
          ))}
          <div className="absolute top-[8.5rem] left-[10%] right-[10%] h-0.5 bg-border -z-10 hidden sm:block" />
        </div>

        <div className="flex-1">
          {step === 1 && (
            <div className="space-y-6">
              <StepConnect 
                credentials={credentials} 
                setCredentials={setCredentials}
                onSuccess={(name, count) => {
                  handleConnectSuccess(name, count);
                  // Auto-advance
                  setTimeout(() => setStep(2), 600);
                }} 
              />
              {publisherName && (
                <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2">
                  <Button onClick={() => setStep(2)} className="w-full sm:w-auto">Continue to Configuration &rarr;</Button>
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
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={StepperApp} />
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
