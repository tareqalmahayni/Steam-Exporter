import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTestConnection } from "@workspace/api-client-react";
import { TutorialPanel } from "./TutorialPanel";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StepConnectProps {
  credentials: { sessionid: string; steamLoginSecure: string };
  setCredentials: (creds: { sessionid: string; steamLoginSecure: string }) => void;
  onSuccess: (publisherName: string, gameCount: number) => void;
}

export function StepConnect({ credentials, setCredentials, onSuccess }: StepConnectProps) {
  const [publisher, setPublisher] = useState<{ name: string; count: number } | null>(null);
  
  const testConnection = useTestConnection({
    mutation: {
      onSuccess: (data) => {
        setPublisher({ name: data.publisherName, count: data.gameCount });
        onSuccess(data.publisherName, data.gameCount);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to connect. Please check your cookies.");
        setPublisher(null);
      }
    }
  });

  const handleTest = () => {
    if (!credentials.sessionid || !credentials.steamLoginSecure) {
      toast.error("Both sessionid and steamLoginSecure are required.");
      return;
    }
    testConnection.mutate({ data: credentials });
  };

  const isSuccess = !!publisher;

  return (
    <Card className="w-full bg-card border-card-border shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">1. Connect to Steamworks</CardTitle>
        <CardDescription>Provide your session cookies to access your publisher data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sessionid" className="font-mono text-sm text-foreground">sessionid</Label>
              <TutorialPanel />
            </div>
            <Input
              id="sessionid"
              type="password"
              placeholder="e.g. abc123def456ghi789jkl012"
              value={credentials.sessionid}
              onChange={(e) => setCredentials({ ...credentials, sessionid: e.target.trim() })}
              className="font-mono bg-background"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="steamLoginSecure" className="font-mono text-sm text-foreground">steamLoginSecure</Label>
              <TutorialPanel />
            </div>
            <Input
              id="steamLoginSecure"
              type="password"
              placeholder="e.g. 76561198000000000%7C|..."
              value={credentials.steamLoginSecure}
              onChange={(e) => setCredentials({ ...credentials, steamLoginSecure: e.target.trim() })}
              className="font-mono bg-background"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button 
            onClick={handleTest} 
            disabled={testConnection.isPending || !credentials.sessionid || !credentials.steamLoginSecure}
            variant={isSuccess ? "secondary" : "default"}
          >
            {testConnection.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
            ) : isSuccess ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-400" /> Re-test Connection</>
            ) : (
              "Test Connection"
            )}
          </Button>

          {isSuccess && (
            <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                {publisher.name} • {publisher.count} Games
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
