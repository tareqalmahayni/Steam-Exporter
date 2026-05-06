import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useListGames, type GameInfo, type PullRequestGranularity } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface StepPickGamesProps {
  credentials: { sessionid: string; steamLoginSecure: string };
  selectedGames: number[];
  setSelectedGames: (appIds: number[]) => void;
  granularity: PullRequestGranularity;
  setGranularity: (g: PullRequestGranularity) => void;
  onGamesLoaded?: (games: GameInfo[]) => void;
}

export function StepPickGames({
  credentials,
  selectedGames,
  setSelectedGames,
  granularity,
  setGranularity,
  onGamesLoaded
}: StepPickGamesProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [skipped, setSkipped] = useState<GameInfo[]>([]);
  
  const listGames = useListGames({
    mutation: {
      onSuccess: (data) => {
        setGames(data.games);
        setSkipped(data.skipped);
        setSelectedGames(data.games.map(g => g.appId));
        if (onGamesLoaded) onGamesLoaded(data.games);
      }
    }
  });

  useEffect(() => {
    listGames.mutate({ data: credentials });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedGames(games.map(g => g.appId));
    } else {
      setSelectedGames([]);
    }
  };

  const handleToggleGame = (appId: number, checked: boolean) => {
    if (checked) {
      setSelectedGames([...selectedGames, appId]);
    } else {
      setSelectedGames(selectedGames.filter(id => id !== appId));
    }
  };

  if (listGames.isPending) {
    return (
      <Card className="w-full bg-card border-card-border shadow-lg">
        <CardContent className="flex flex-col items-center justify-center h-48 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching your games...</p>
        </CardContent>
      </Card>
    );
  }

  if (listGames.isError) {
    return (
      <Card className="w-full bg-card border-destructive/50 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center h-48 space-y-4">
          <p className="text-sm text-destructive">Failed to load games. Session might be invalid.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card border-card-border shadow-lg animate-in fade-in slide-in-from-bottom-4">
      <CardHeader>
        <CardTitle className="text-xl">2. Pick Games & Range</CardTitle>
        <CardDescription>Select the base games and time range for your export.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Games ({selectedGames.length}/{games.length})</h3>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="select-all" 
                checked={selectedGames.length === games.length && games.length > 0}
                onCheckedChange={handleToggleAll}
              />
              <Label htmlFor="select-all" className="text-xs cursor-pointer">Select All</Label>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
            {games.map(game => (
              <div key={game.appId} className="flex items-start space-x-3 p-3 rounded-md border border-border bg-background/50 hover:bg-background transition-colors">
                <Checkbox 
                  id={`game-${game.appId}`}
                  checked={selectedGames.includes(game.appId)}
                  onCheckedChange={(c) => handleToggleGame(game.appId, !!c)}
                  className="mt-0.5"
                />
                <div className="grid gap-1 leading-none">
                  <label 
                    htmlFor={`game-${game.appId}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {game.name}
                  </label>
                  <p className="text-xs text-muted-foreground font-mono">AppID: {game.appId}</p>
                </div>
              </div>
            ))}
            {games.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                No base games found.
              </div>
            )}
          </div>
          
          {skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped {skipped.length} hidden apps (demos, playtests, toolkits).
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h3>
          <RadioGroup 
            value={granularity} 
            onValueChange={(val: any) => setGranularity(val)}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { id: 'daily', label: 'Daily', desc: 'Last 30 days' },
              { id: 'weekly', label: 'Weekly', desc: 'Last 12 weeks' },
              { id: 'monthly', label: 'Monthly', desc: 'Last 12 months' },
              { id: 'lifetime', label: 'Lifetime', desc: 'All time' },
            ].map((range) => (
              <div key={range.id}>
                <RadioGroupItem value={range.id} id={`range-${range.id}`} className="peer sr-only" />
                <Label
                  htmlFor={`range-${range.id}`}
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                >
                  <span className="text-sm font-bold uppercase">{range.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{range.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

      </CardContent>
    </Card>
  );
}
