import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { DesktopApp } from "@/components/DesktopApp";

const queryClient = new QueryClient();

function WebFallback() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold text-primary">Steamworks Exporter</h1>
        <p className="text-sm text-muted-foreground">
          This tool now ships as a desktop app. The web flows (bookmarklet and
          cookie paste) were retired because Steam blocks logins from
          data-center IPs. Download the latest installer for your OS from the{" "}
          <a
            href="https://github.com/"
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            releases page
          </a>{" "}
          to continue.
        </p>
        <p className="text-xs text-muted-foreground">
          (When you launch the desktop app you'll see the sign-in screen here
          instead of this notice.)
        </p>
      </div>
    </div>
  );
}

function HomePage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDesktop(typeof window !== "undefined" && !!window.desktop);
  }, []);

  if (isDesktop === null) return null;
  return isDesktop ? <DesktopApp /> : <WebFallback />;
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
