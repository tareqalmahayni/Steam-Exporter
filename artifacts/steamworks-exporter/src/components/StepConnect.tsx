import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTestConnection } from "@workspace/api-client-react";
import { TutorialPanel } from "./TutorialPanel";
import { CheckCircle2, Loader2, AlertTriangle, HelpCircle } from "lucide-react";

interface StepConnectProps {
  credentials: { sessionid: string; steamLoginSecure: string };
  setCredentials: (creds: { sessionid: string; steamLoginSecure: string }) => void;
  onSuccess: (publisherName: string, gameCount: number) => void;
}

export function StepConnect({ credentials, setCredentials, onSuccess }: StepConnectProps) {
  const [publisher, setPublisher] = useState<{ name: string; count: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const testConn = useTestConnection({
    mutation: {
      onSuccess: (data) => {
        setPublisher({ name: data.publisherName, count: data.gameCount });
        setErrorMsg(null);
        onSuccess(data.publisherName, data.gameCount);
      },
      onError: (error: unknown) => {
        setPublisher(null);
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          setErrorMsg("expired");
        } else {
          const msg = (error as Error)?.message || "Unknown error";
          setErrorMsg(msg);
        }
      },
    },
  });

  const handleTest = () => {
    if (!credentials.sessionid || !credentials.steamLoginSecure) {
      setErrorMsg("Both fields are required.");
      return;
    }
    setErrorMsg(null);
    setPublisher(null);
    testConn.mutate({ data: credentials });
  };

  const isSuccess = !!publisher;

  return (
    <Card className="w-full bg-card border-card-border shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">1. Connect to Steamworks</CardTitle>
        <CardDescription>
          Provide your session cookies to access your publisher data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* sessionid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sessionid" className="font-mono text-sm text-foreground">
              sessionid
            </Label>
            <TutorialPanel />
          </div>
          <Input
            id="sessionid"
            data-testid="input-sessionid"
            type="password"
            placeholder="e.g. abc123def456ghi789jkl012"
            value={credentials.sessionid}
            onChange={(e) => {
              setErrorMsg(null);
              setCredentials({ ...credentials, sessionid: e.target.value.trim() });
            }}
            className="font-mono bg-background"
          />
        </div>

        {/* steamLoginSecure */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="steamLoginSecure" className="font-mono text-sm text-foreground">
              steamLoginSecure
            </Label>
            <TutorialPanel />
          </div>
          <Input
            id="steamLoginSecure"
            data-testid="input-steam-login-secure"
            type="password"
            placeholder="e.g. 76561198000000000%7C..."
            value={credentials.steamLoginSecure}
            onChange={(e) => {
              setErrorMsg(null);
              setCredentials({ ...credentials, steamLoginSecure: e.target.value.trim() });
            }}
            className="font-mono bg-background"
          />
        </div>

        {/* Error state */}
        {errorMsg && errorMsg === "expired" && (
          <Alert className="border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="ml-2 text-sm space-y-2">
              <p className="font-medium text-destructive">Cookies rejected by Steamworks</p>
              <p className="text-muted-foreground text-xs">
                Steam is not accepting these cookies. They may be expired (they last ~7 days) or copied incorrectly.
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>Make sure you are logged in to <span className="font-mono">partner.steamgames.com</span> first</li>
                <li>Copy the <strong>Value</strong> column — not the name</li>
                <li><code className="bg-muted px-1 rounded">steamLoginSecure</code> is long (100+ chars)</li>
                <li><code className="bg-muted px-1 rounded">sessionid</code> is short (≈32 chars, letters/numbers only)</li>
              </ul>
              <div className="pt-1">
                <TutorialPanel>
                  <button className="text-xs text-primary underline underline-offset-2 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Step-by-step instructions
                  </button>
                </TutorialPanel>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {errorMsg && errorMsg !== "expired" && (
          <Alert className="border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="ml-2 text-sm text-destructive">
              {errorMsg}
            </AlertDescription>
          </Alert>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">
          <Button
            onClick={handleTest}
            data-testid="button-test-connection"
            disabled={
              testConn.isPending ||
              !credentials.sessionid ||
              !credentials.steamLoginSecure
            }
            variant={isSuccess ? "secondary" : "default"}
          >
            {testConn.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing…
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" /> Re-test Connection
              </>
            ) : (
              "Test Connection"
            )}
          </Button>

          {isSuccess && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 px-3 py-1"
                data-testid="badge-publisher"
              >
                {publisher.name}
                {publisher.count > 0 && ` · ${publisher.count} game${publisher.count !== 1 ? "s" : ""}`}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
