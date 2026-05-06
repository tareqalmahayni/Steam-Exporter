import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListGames, type GameInfo, type PullRequestGranularity } from "@workspace/api-client-react";
import { Loader2, RefreshCw, AlertTriangle, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Credentials {
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
}

interface StepPickGamesProps {
  credentials: Credentials;
  selectedGames: number[];
  setSelectedGames: (appIds: number[]) => void;
  granularity: PullRequestGranularity;
  setGranularity: (g: PullRequestGranularity) => void;
  customStartIso: string;
  setCustomStartIso: (v: string) => void;
  customEndIso: string;
  setCustomEndIso: (v: string) => void;
}

interface TotalsState {
  loading: boolean;
  data?: { wishlists: number; impressions: number; visits: number; errors: string[] };
  error?: string;
}

export function StepPickGames({
  credentials,
  selectedGames,
  setSelectedGames,
  granularity,
  setGranularity,
  customStartIso,
  setCustomStartIso,
  customEndIso,
  setCustomEndIso,
}: StepPickGamesProps) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [skipped, setSkipped] = useState<GameInfo[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [totals, setTotals] = useState<Record<number, TotalsState>>({});

  const today = new Date().toISOString().slice(0, 10);

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

  const handleRetry = () => listGames.mutate({ data: credentials });

  const handleToggleAll = (checked: boolean) =>
    setSelectedGames(checked ? games.map((g) => g.appId) : []);

  const handleToggleGame = (appId: number, checked: boolean) =>
    setSelectedGames(
      checked ? [...selectedGames, appId] : selectedGames.filter((id) => id !== appId)
    );

  const fetchTotals = async (appId: number) => {
    setTotals((t) => ({ ...t, [appId]: { loading: true } }));
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/games/totals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, appId }),
      });
      const json = (await resp.json()) as {
        wishlists?: number;
        impressions?: number;
        visits?: number;
        errors?: string[];
        message?: string;
      };
      if (!resp.ok) {
        setTotals((t) => ({ ...t, [appId]: { loading: false, error: json.message || `HTTP ${resp.status}` } }));
        return;
      }
      setTotals((t) => ({
        ...t,
        [appId]: {
          loading: false,
          data: {
            wishlists: json.wishlists ?? 0,
            impressions: json.impressions ?? 0,
            visits: json.visits ?? 0,
            errors: json.errors ?? [],
          },
        },
      }));
    } catch (e) {
      setTotals((t) => ({ ...t, [appId]: { loading: false, error: (e as Error).message } }));
    }
  };

  const handleToggleExpand = (appId: number) => {
    const willOpen = !expanded[appId];
    setExpanded((e) => ({ ...e, [appId]: willOpen }));
    if (willOpen && !totals[appId]) {
      void fetchTotals(appId);
    }
  };

  const handleManualAdd = () => {
    setManualError("");
    const parts = manualInput.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);

    const newGames: GameInfo[] = [];
    for (const part of parts) {
      const id = parseInt(part, 10);
      if (isNaN(id) || id <= 0) {
        setManualError(`"${part}" is not a valid App ID.`);
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
            Your Steam session may have expired. Sign out and sign back in, or enter your App IDs manually.
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

  const dateRanges: { id: PullRequestGranularity; label: string; desc: string }[] = [
    { id: "today" as PullRequestGranularity, label: "Today", desc: "Just today" },
    { id: "previous-month" as PullRequestGranularity, label: "Previous Month", desc: "Last calendar month" },
    { id: "previous-year" as PullRequestGranularity, label: "Previous Year", desc: "Last calendar year" },
    { id: "lifetime" as PullRequestGranularity, label: "Lifetime", desc: "Since launch" },
    { id: "custom" as PullRequestGranularity, label: "Custom", desc: "Pick your own range" },
  ];

  const customInvalid =
    granularity === ("custom" as PullRequestGranularity) &&
    !!customStartIso &&
    !!customEndIso &&
    customStartIso > customEndIso;

  return (
    <Card className="w-full bg-card border-card-border shadow-lg animate-in fade-in slide-in-from-bottom-4">
      <CardHeader>
        <CardTitle className="text-xl">2. Pick Games & Range</CardTitle>
        <CardDescription>Select the base games and time range for your export. Click a game row to see its lifetime totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">

        {noGamesFound && !manualMode && (
          <Alert className="border-yellow-600/40 bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="ml-2 text-sm">
              <span className="font-medium text-yellow-400">No games found automatically.</span>{" "}
              <span className="text-muted-foreground">
                Steamworks may have changed its page layout. You can retry, or enter your App IDs directly.
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

        {manualMode && (
          <ManualEntry manualInput={manualInput} setManualInput={setManualInput} manualError={manualError} onAdd={handleManualAdd} onCancel={games.length > 0 ? () => setManualMode(false) : undefined} />
        )}

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

            <div className="space-y-2 max-h-[360px] overflow-y-auto p-1">
              {games.map((game) => {
                const isOpen = !!expanded[game.appId];
                const t = totals[game.appId];
                return (
                  <div
                    key={game.appId}
                    data-testid={`game-row-${game.appId}`}
                    className="rounded-md border border-border bg-background/50 overflow-hidden"
                  >
                    <div className="flex items-start gap-3 p-3 hover:bg-background transition-colors">
                      <Checkbox
                        id={`game-${game.appId}`}
                        data-testid={`checkbox-game-${game.appId}`}
                        checked={selectedGames.includes(game.appId)}
                        onCheckedChange={(c) => handleToggleGame(game.appId, !!c)}
                        className="mt-0.5"
                      />
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left flex items-start gap-2"
                        onClick={() => handleToggleExpand(game.appId)}
                        data-testid={`button-expand-${game.appId}`}
                      >
                        <span className="mt-0.5 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                        <span className="grid gap-1 leading-none min-w-0">
                          <span className="text-sm font-medium leading-none truncate">{game.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">AppID: {game.appId}</span>
                        </span>
                      </button>
                    </div>
                    {isOpen && (
                      <div
                        className="border-t border-border/60 bg-background/30 px-4 py-3"
                        data-testid={`totals-${game.appId}`}
                      >
                        {t?.loading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching lifetime totals…
                          </div>
                        )}
                        {t?.error && (
                          <div className="text-xs text-destructive">Couldn't load totals: {t.error}</div>
                        )}
                        {t?.data && (
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <Stat label="Total Wishlists" value={t.data.wishlists} />
                            <Stat label="Total Impressions" value={t.data.impressions} />
                            <Stat label="Total Visits" value={t.data.visits} />
                          </div>
                        )}
                        {t?.data && t.data.errors.length > 0 && (
                          <div className="mt-2 text-[11px] text-yellow-500/80">
                            {t.data.errors.length} metric{t.data.errors.length === 1 ? "" : "s"} unavailable
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {skipped.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Auto-excluded {skipped.length} non-game app{skipped.length !== 1 ? "s" : ""} (demos, playtests, DLC).
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h3>
          <RadioGroup
            value={granularity}
            onValueChange={(val) => setGranularity(val as PullRequestGranularity)}
            className="grid grid-cols-2 md:grid-cols-5 gap-3"
          >
            {dateRanges.map((range) => (
              <div key={range.id}>
                <RadioGroupItem
                  value={range.id}
                  id={`range-${range.id}`}
                  data-testid={`radio-range-${range.id}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`range-${range.id}`}
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all h-full"
                >
                  <span className="text-sm font-bold uppercase">{range.label}</span>
                  <span className="text-xs text-muted-foreground mt-1 text-center">{range.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {granularity === ("custom" as PullRequestGranularity) && (
            <div className="rounded-md border border-border bg-background/30 p-4 space-y-3" data-testid="custom-range-picker">
              <p className="text-xs text-muted-foreground">
                Pick a start and end date. Both are capped at today.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="custom-start" className="text-xs">Start date</Label>
                  <Input
                    id="custom-start"
                    type="date"
                    max={today}
                    value={customStartIso}
                    onChange={(e) => setCustomStartIso(e.target.value)}
                    data-testid="input-custom-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-end" className="text-xs">End date</Label>
                  <Input
                    id="custom-end"
                    type="date"
                    max={today}
                    value={customEndIso}
                    onChange={(e) => setCustomEndIso(e.target.value)}
                    data-testid="input-custom-end"
                  />
                </div>
              </div>
              {customInvalid && (
                <p className="text-xs text-destructive">Start date must be on or before end date.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-lg font-bold text-primary tabular-nums">{value.toLocaleString()}</span>
    </div>
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
