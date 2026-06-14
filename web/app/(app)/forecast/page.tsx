"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Sparkles, Loader2, CalendarRange } from "lucide-react";
import { ForecastActions, type ForecastPlan } from "@/components/forecast-actions";
import { ForecastAiLoader } from "@/components/forecast-ai-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { usePlanner, useRequirements, startOfWeek, toISO } from "@/lib/planner";
import { buildForecast, buildRecommendationPayload } from "@/lib/forecast";
import { ForecastRequirements } from "@/components/forecast-requirements";
import { ForecastSkeleton, ChartSkeleton } from "@/components/skeletons";

// Lazily load the heavy SVG/table visualisations — they're below the fold and
// pull in layout-heavy markup. Each shows a skeleton while its chunk loads.
const ForecastHeatmap = dynamic(
  () => import("@/components/forecast-heatmap").then((m) => m.ForecastHeatmap),
  { loading: () => <ChartSkeleton rows={4} />, ssr: false }
);
const ForecastGantt = dynamic(
  () => import("@/components/forecast-gantt").then((m) => m.ForecastGantt),
  { loading: () => <ChartSkeleton rows={5} />, ssr: false }
);

const KEY = "openplanner_anthropic_key";
const HORIZONS = [
  { label: "12 weeks", weeks: 12 },
  { label: "6 months", weeks: 26 },
  { label: "12 months", weeks: 52 },
];

export default function ForecastPage() {
  const { projects, resources, allocations, isLoading: pL } = usePlanner();
  const { requirements, isLoading: rL } = useRequirements();
  const isLoading = pL || rL;

  const [fromDate, setFromDate] = useState(toISO(startOfWeek(new Date())));
  const [horizon, setHorizon] = useState(12);

  const [apiKey, setApiKey] = useState<string | null>(null);
  useEffect(() => setApiKey(localStorage.getItem(KEY)), []);

  const [recs, setRecs] = useState<ForecastPlan | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const forecast = useMemo(
    () =>
      buildForecast({
        fromDate,
        horizonWeeks: horizon,
        projects,
        resources,
        allocations,
        requirements,
      }),
    [fromDate, horizon, projects, resources, allocations, requirements]
  );

  const totalGapFte = forecast.gaps.reduce((s, g) => s + g.shortfallFte, 0);
  const hireRoles = [...new Set(forecast.gaps.filter((g) => g.noResourcesOfRole).map((g) => g.role))];

  async function getRecommendations() {
    if (!apiKey) {
      setRecError("Add your Anthropic API key in Settings to use AI recommendations.");
      return;
    }
    setRecLoading(true);
    setRecError(null);
    setRecs(null);
    try {
      const summary = buildRecommendationPayload(forecast, resources, projects);
      const res = await fetch("/api/forecast/recommend", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ summary }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? json?.error ?? "Request failed");
      setRecs(json.plan);
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Failed to get recommendations.");
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarRange className="h-5 w-5" />
            Capacity Forecasting
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A non-binding scenario — as people roll off current work, where could they go, and where
            are the gaps?
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Forecast from</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => e.target.value && setFromDate(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Horizon</label>
            <div className="flex gap-1">
              {HORIZONS.map((h) => (
                <Button
                  key={h.weeks}
                  size="sm"
                  variant={horizon === h.weeks ? "default" : "outline"}
                  onClick={() => setHorizon(h.weeks)}
                >
                  {h.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects with demand" value={String(new Set(requirements.map((r) => r.projectId)).size)} />
        <Stat label="Staffing gaps" value={String(forecast.gaps.length)} tone={forecast.gaps.length ? "bad" : "good"} />
        <Stat label="Total shortfall" value={`${totalGapFte.toFixed(1)} FTE`} tone={totalGapFte > 0 ? "bad" : "good"} />
        <Stat label="Roles to hire" value={String(hireRoles.length)} tone={hireRoles.length ? "bad" : "good"} />
      </div>

      {isLoading ? (
        <ForecastSkeleton />
      ) : (
        <>
          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Supply vs demand by role (FTE, net per week)</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastHeatmap forecast={forecast} />
            </CardContent>
          </Card>

          {/* Gantt */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Capacity timeline — roll-off &amp; proposed moves</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastGantt forecast={forecast} projects={projects} resources={resources} />
            </CardContent>
          </Card>

          {/* Gaps + AI */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Gaps &amp; recommendations</CardTitle>
              <Button size="sm" variant="outline" onClick={getRecommendations} disabled={recLoading}>
                {recLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Get AI recommendations
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {forecast.gaps.length === 0 ? (
                <p className="text-sm text-emerald-700">
                  No staffing gaps in this window — current people cover all defined demand.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {forecast.gaps.map((g, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span>
                        <span className="font-medium">{g.projectName}</span> needs{" "}
                        <span className="font-medium">{g.shortfallFte} FTE</span> of{" "}
                        <span className="font-medium">{g.role}</span> for {g.weeks} wk
                        {g.noResourcesOfRole && (
                          <Badge className="ml-1.5 bg-red-100 px-1.5 py-0 text-[10px] text-red-700 hover:bg-red-100">
                            no one in this role — hire
                          </Badge>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {recError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {recError}
                </p>
              )}
              {recLoading && <ForecastAiLoader />}
              {!recLoading && recs && <ForecastActions plan={recs} projects={projects} />}
            </CardContent>
          </Card>

          {/* Requirements editor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Project resource requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastRequirements />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          tone === "bad" && value !== "0" && value !== "0.0 FTE" ? "text-red-600" : tone === "good" ? "text-emerald-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
