import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListGames, type GameInfo, type PullRequestGranularity } from "@workspace/api-client-react";
import { Loader2, RefreshCw, AlertTriangle, PlusCircle, FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StepPickGamesProps {
  credentials: { sessionid: string; steamLoginSecure: string; partnerSessionid: string; partnerSteamLoginSecure: string };
  selectedGames: number[];
  setSelectedGames: (appIds: number[]) => void;
  granularity: PullRequestGranularity;
  setGranularity: (g: PullRequestGranularity) => void;
}

interface ProbeResult {
  metric: string;
  url: string;
  status: number;
  contentType: string;
  bodyLen: number;
  bodySnippet: string;
  parsedRowCount: number;
}

export function StepPickGames({
  credentials,
  selectedGames,
  setSelectedGames,
  granularity,
  setGranularity,
}: StepPickGamesProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [skipped, setSkipped] = useState<GameInfo[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState("");
  const [probeResults, setProbeResults] = useState<ProbeResult[] | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [probeOpen, setProbeOpen] = useState(false);

  const listGames = useListGames({
    mutation: {
      onSuccess: (data) => {
        setGames(data.games);
        setSkipped(data.skipped);
        setSelectedGames(data.games.map((g) => g.appId));
      },
    },
  });

  useEffect(() => {
    listGames.mutate({ data: credentials });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    listGames.mutate({ data: credentials });
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedGames(checked ? games.map((g) => g.appId) : []);
  };

  const handleToggleGame = (appId: number, checked: boolean) => {
    setSelectedGames(
      checked ? [...selectedGames, appId] : selectedGames.filter((id) => id !== appId)
    );
  };

  const handleManualAdd = () => {
    setManualError("");
    const parts = manualInput
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newGames: GameInfo[] = [];
    for (const part of parts) {
      const id = parseInt(part, 10);
      if (isNaN(id) || id <= 0) {
        setManualError(`"${part}" is not a valid App ID. Enter numeric Steam App IDs only.`);
        return;
      }
      if (!games.find((g) => g.appId === id)) {
        newGames.push({ appId: id, name: `App ${id}`, type: "game" });
      }
    }

    if (newGames.length === 0) {
      setManualError("All those App IDs are already in the list.");
      return;
    }

    const updated = [...games, ...newGames];
    setGames(updated);
    setSelectedGames([...selectedGames, ...newGames.map((g) => g.appId)]);
    setManualInput("");
    setManualMode(false);
  };

  const handleProbe = async () => {
    const appId = selectedGames[0] ?? games[0]?.appId;
    if (!appId) return;
    setProbeLoading(true);
    setProbeError("");
    setProbeResults(null);
    setProbeOpen(true);
    try {
      const resp = await fetch("/api/pull/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, appId, granularity }),
      });
      const json = await resp.json() as { results?: ProbeResult[]; message?: string };
      if (!resp.ok) throw new Error(json.message || `HTTP ${resp.status}`);
      setProbeResults(json.results ?? []);
    } catch (e) {
      setProbeError((e as Error).message);
    } finally {
      setProbeLoading(false);
    }
  };

  const noGamesFound = !listGames.isPending && !listGames.isError && games.length === 0;

  if (listGames.isPending) {
    return (
      <Card className="w-full bg-card border-card-border shadow-lg">
        <CardContent className="flex flex-col items-center justify-center h-48 space-y-4 pt-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching your games from Steamworks...</p>
        </CardContent>
      </Card>
    );
  }

  if (listGames.isError) {
    return (
      <Card className="w-full bg-card border-destructive/50 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive font-medium">Failed to load games</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            Your session may have expired. Go back and re-paste fresh cookies, or enter your App IDs manually below.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => setManualMode(true)}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Enter IDs manually
            </Button>
          </div>
          {manualMode && <ManualEntry manualInput={manualInput} setManualInput={setManualInput} manualError={manualError} onAdd={handleManualAdd} />}
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

        {/* No games warning */}
        {noGamesFound && !manualMode && (
          <Alert className="border-yellow-600/40 bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="ml-2 text-sm">
              <span className="font-medium text-yellow-400">No games found automatically.</span>{" "}
              <span className="text-muted-foreground">
                Steamworks may have changed its page layout. You can retry, or enter your Steam App IDs directly.
              </span>
              <div className="flex gap-3 mt-3">
                <Button variant="outline" size="sm" onClick={handleRetry} disabled={listGames.isPending}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
                <Button variant="outline" size="sm" onClick={() => setManualMode(true)}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Enter App IDs manually
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Manual entry panel */}
        {manualMode && (
          <ManualEntry manualInput={manualInput} setManualInput={setManualInput} manualError={manualError} onAdd={handleManualAdd} onCancel={games.length > 0 ? () => setManualMode(false) : undefined} />
        )}

        {/* Game list */}
        {games.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Games ({selectedGames.length}/{games.length})
              </h3>
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setManualMode(true)}>
                  <PlusCircle className="h-3 w-3 mr-1" /> Add IDs
                </Button>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    data-testid="checkbox-select-all"
                    checked={selectedGames.length === games.length && games.length > 0}
                    onCheckedChange={handleToggleAll}
                  />
                  <Label htmlFor="select-all" className="text-xs cursor-pointer">
                    Select All
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
              {games.map((game) => (
                <div
                  key={game.appId}
                  data-testid={`game-row-${game.appId}`}
                  className="flex items-start space-x-3 p-3 rounded-md border border-border bg-background/50 hover:bg-background transition-colors"
                >
                  <Checkbox
                    id={`game-${game.appId}`}
                    data-testid={`checkbox-game-${game.appId}`}
                    checked={selectedGames.includes(game.appId)}
                    onCheckedChange={(c) => handleToggleGame(game.appId, !!c)}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1 leading-none min-w-0">
                    <label
                      htmlFor={`game-${game.appId}`}
                      className="text-sm font-medium leading-none cursor-pointer truncate"
                    >
                      {game.name}
                    </label>
                    <p className="text-xs text-muted-foreground font-mono">AppID: {game.appId}</p>
                  </div>
                </div>
              ))}
            </div>

            {skipped.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Auto-excluded {skipped.length} non-game app{skipped.length !== 1 ? "s" : ""} (demos, playtests, DLC).
              </p>
            )}
          </div>
        )}

        {/* Date range */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h3>
          <RadioGroup
            value={granularity}
            onValueChange={(val) => setGranularity(val as PullRequestGranularity)}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { id: "today", label: "Today", desc: "Just today" },
              { id: "previous-month", label: "Previous Month", desc: "Last calendar month" },
              { id: "previous-year", label: "Previous Year", desc: "Last calendar year" },
              { id: "lifetime", label: "Lifetime", desc: "Since launch" },
            ].map((range) => (
              <div key={range.id}>
                <RadioGroupItem
                  value={range.id}
                  id={`range-${range.id}`}
                  data-testid={`radio-range-${range.id}`}
                  className="peer sr-only"
                />
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

        {/* Diagnostic probe */}
        {(games.length > 0 || selectedGames.length > 0) && (
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                If stats come back empty, run a quick endpoint probe to see what Steamworks actually returns.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="ml-4 shrink-0 text-xs"
                onClick={handleProbe}
                disabled={probeLoading || (selectedGames.length === 0 && games.length === 0)}
              >
                {probeLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Probing...</>
                ) : (
                  <><FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Probe Stats Endpoints</>
                )}
              </Button>
            </div>

            {probeOpen && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Probe Results — AppID {selectedGames[0] ?? games[0]?.appId}
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setProbeOpen(false)}>
                    Hide
                  </Button>
                </div>
                {probeError && (
                  <p className="text-xs text-destructive">{probeError}</p>
                )}
                {probeResults && (
                  <div className="rounded-md border border-border overflow-hidden text-xs font-mono">
                    <div className="grid grid-cols-[140px_60px_80px_1fr] bg-muted/50 px-3 py-1.5 font-sans font-semibold text-muted-foreground border-b border-border">
                      <span>Endpoint</span>
                      <span>HTTP</span>
                      <span>Rows found</span>
                      <span>Body snippet</span>
                    </div>
                    {probeResults.map((r, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[140px_60px_80px_1fr] px-3 py-2 border-b border-border/50 last:border-0 items-start gap-2 hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-foreground truncate" title={r.metric}>{r.metric}</span>
                        <span className={r.status >= 200 && r.status < 300 ? "text-green-400" : "text-destructive"}>
                          {r.status || "err"}
                        </span>
                        <span className="flex items-center gap-1">
                          {r.parsedRowCount > 0 ? (
                            <><CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />{r.parsedRowCount}</>
                          ) : (
                            <><XCircle className="h-3 w-3 text-muted-foreground shrink-0" />0</>
                          )}
                        </span>
                        <span
                          className="text-muted-foreground truncate leading-tight"
                          title={r.bodySnippet}
                        >
                          {r.bodySnippet.slice(0, 120)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {probeResults && probeResults.every((r) => r.parsedRowCount === 0) && (
                  <Alert className="border-orange-600/40 bg-orange-950/20">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    <AlertDescription className="ml-2 text-xs text-muted-foreground">
                      All endpoints returned 0 rows. The body snippets above show what Steamworks is actually sending back — share them so the scraper can be updated to match.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManualEntry({
  manualInput,
  setManualInput,
  manualError,
  onAdd,
  onCancel,
}: {
  manualInput: string;
  setManualInput: (v: string) => void;
  manualError: string;
  onAdd: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/30 p-4 space-y-3">
      <p className="text-sm font-medium">Enter Steam App IDs</p>
      <p className="text-xs text-muted-foreground">
        Find your App ID in the Steamworks URL: <span className="font-mono">partner.steamgames.com/apps/landing/<span className="text-primary">1234567</span></span>.
        Paste one or more IDs separated by commas or spaces.
      </p>
      <Input
        data-testid="input-manual-appids"
        placeholder="e.g. 1234567, 2345678, 3456789"
        value={manualInput}
        onChange={(e) => setManualInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        className="font-mono bg-background"
      />
      {manualError && <p className="text-xs text-destructive">{manualError}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={onAdd} disabled={!manualInput.trim()} data-testid="button-add-manual">
          Add Games
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
