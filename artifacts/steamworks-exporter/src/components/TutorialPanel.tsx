import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, HelpCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TutorialPanel({ children }: { children?: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-primary">
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            How do I find this?
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold">Finding your Steam Cookies</SheetTitle>
          <SheetDescription className="text-sm">
            To pull your stats, this tool needs temporary access to your Steamworks dashboard using your browser cookies.
          </SheetDescription>
        </SheetHeader>

        <Alert className="mb-6 bg-secondary/30 border-secondary">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs text-muted-foreground ml-2">
            <strong>Safety Note:</strong> Your cookies are only stored locally in this browser tab. They are never saved to our servers. They expire automatically in about a week.
          </AlertDescription>
        </Alert>

        <Alert className="mb-6 bg-primary/5 border-primary/30">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs text-foreground ml-2 space-y-1">
            <p className="font-medium">You need 4 cookies total — 2 from each Steam domain:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              <li><span className="font-mono">partner.steamgames.com</span> → <span className="font-mono">sessionid</span> + <span className="font-mono">steamLoginSecure</span></li>
              <li><span className="font-mono">partner.steampowered.com</span> → <span className="font-mono">sessionid</span> + <span className="font-mono">steamLoginSecure</span></li>
            </ul>
            <p className="text-muted-foreground pt-1">Steam mints these as separate cookies. The cookies on one domain are not valid on the other.</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step 1: Log In to Both Sites</h3>
            <p className="text-sm">In your browser, log in to both:</p>
            <ul className="list-disc list-inside text-sm space-y-1 pl-1">
              <li><a href="https://partner.steamgames.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">partner.steamgames.com</a></li>
              <li><a href="https://partner.steampowered.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">partner.steampowered.com</a></li>
            </ul>
            <p className="text-xs text-muted-foreground">(Logging in to one usually logs you in to the other automatically — but each site stores its own cookies.)</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step 2: Open DevTools</h3>
            <Tabs defaultValue="chrome" className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="chrome">Chrome</TabsTrigger>
                <TabsTrigger value="edge">Edge</TabsTrigger>
                <TabsTrigger value="firefox">Firefox</TabsTrigger>
                <TabsTrigger value="safari">Safari</TabsTrigger>
              </TabsList>

              <TabsContent value="chrome" className="text-sm space-y-2">
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>Press <kbd className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">F12</kbd> or right-click and select <strong>Inspect</strong></li>
                  <li>Go to the <strong>Application</strong> tab (may be hidden behind the <code>{">>"}</code> icon)</li>
                  <li>In the left sidebar, expand <strong>Cookies</strong></li>
                </ol>
              </TabsContent>

              <TabsContent value="edge" className="text-sm space-y-2">
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>Press <kbd className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">F12</kbd> or right-click and select <strong>Inspect</strong></li>
                  <li>Go to the <strong>Application</strong> tab</li>
                  <li>In the left sidebar, expand <strong>Cookies</strong></li>
                </ol>
              </TabsContent>

              <TabsContent value="firefox" className="text-sm space-y-2">
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>Press <kbd className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">F12</kbd> or right-click and select <strong>Inspect</strong></li>
                  <li>Go to the <strong>Storage</strong> tab</li>
                  <li>In the left sidebar, expand <strong>Cookies</strong></li>
                </ol>
              </TabsContent>

              <TabsContent value="safari" className="text-sm space-y-2">
                <ol className="list-decimal list-inside space-y-2 pl-1">
                  <li>Enable Develop menu in Safari Preferences &rarr; Advanced</li>
                  <li>Press <kbd className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">Option+Cmd+I</kbd></li>
                  <li>Go to the <strong>Storage</strong> tab</li>
                  <li>Click on <strong>Cookies</strong> in the left sidebar</li>
                </ol>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step 3: Copy 4 Values</h3>

            <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">From <span className="font-mono">https://partner.steamgames.com</span>:</p>
              <ul className="list-disc list-inside text-xs space-y-1 pl-1 font-mono text-muted-foreground">
                <li>sessionid</li>
                <li>steamLoginSecure</li>
              </ul>
            </div>

            <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">From <span className="font-mono">https://partner.steampowered.com</span>:</p>
              <ul className="list-disc list-inside text-xs space-y-1 pl-1 font-mono text-muted-foreground">
                <li>sessionid</li>
                <li>steamLoginSecure</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">In the cookies panel, click on each domain in turn, double-click the <strong>Value</strong> column for each row, and paste it into the matching field in the tool.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
