import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { DesktopApp } from "@/components/DesktopApp";
import { ReportBuilder } from "@/pages/ReportBuilder";

const queryClient = new QueryClient();

function HomePage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDesktop(typeof window !== "undefined" && !!window.desktop);
  }, []);

  if (isDesktop === null) return null;
  // M7: when running in the browser (no Electron preload bridge), show the
  // web Report Builder. The Electron desktop flow is unchanged.
  return isDesktop ? <DesktopApp /> : <ReportBuilder />;
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
