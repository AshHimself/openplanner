"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Layers, ChartColumn, TriangleAlert } from "lucide-react";
import {
  usePlanner,
  getWeeks,
  formatWeek,
  hoursInWeek,
  formatCurrency,
  projectForecast,
  parseLocalDate,
  startOfWeek,
  addWeeks,
} from "@/lib/planner";
import type { Resource } from "@/lib/planner";
import { ResourceProfile } from "@/components/resource-profile";

const HORIZON = 12;
const FREE_THRESHOLD = 8;

function freeCellClass(free: number, capacity: number): string {
  if (free < 0) return "bg-red-500";
  if (free === 0) return "bg-amber-400";
  if (free < capacity * 0.25) return "bg-amber-200";
  if (free < capacity) return "bg-emerald-300";
  return "bg-emerald-500";
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  alert,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ${alert ? "ring-red-300" : "ring-foreground/10"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Icon className={`h-4 w-4 ${alert ? "text-red-500" : "text-muted-foreground"}`} />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { resources, projects, allocations, isLoading } = usePlanner();
  const [profileId, setProfileId] = useState<string | null>(null);
  const weeks = useMemo(() => getWeeks(HORIZON), []);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const loadFor = (resourceId: string, week: Date) =>
    allocations
      .filter((a) => a.resourceId === resourceId)
      .reduce((sum, a) => sum + hoursInWeek(a, week), 0);

  interface ResourceRow {
    resource: Resource;
    loads: number[];
    frees: number[];
    nextOpening: Date | null;
    fullyFreeFrom: Date | null;
    freeTotal: number;
    avgUtil: number;
  }

  const rows: ResourceRow[] = useMemo(
    () =>
      resources.map((r) => {
        const loads = weeks.map((w) => loadFor(r.id, w));
        const frees = loads.map((l) => r.capacity - l);
        const nextIdx = frees.findIndex((f) => f >= FREE_THRESHOLD);
        const myAllocs = allocations.filter((a) => a.resourceId === r.id);
        const lastEnd =
          myAllocs.length > 0
            ? myAllocs.reduce(
                (max, a) =>
                  parseLocalDate(a.endDate) > max ? parseLocalDate(a.endDate) : max,
                parseLocalDate(myAllocs[0].endDate)
              )
            : null;
        const fullyFreeFrom = lastEnd
          ? addWeeks(startOfWeek(lastEnd), 1)
          : null;
        const freeTotal = frees.reduce((s, f) => s + Math.max(f, 0), 0);
        const avgUtil =
          r.capacity > 0 ? loads.reduce((s, l) => s + l, 0) / (r.capacity * HORIZON) : 0;
        return {
          resource: r,
          loads,
          frees,
          nextOpening: nextIdx >= 0 ? weeks[nextIdx] : null,
          fullyFreeFrom,
          freeTotal,
          avgUtil,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resources, allocations, weeks]
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const t = (r: ResourceRow) =>
          r.fullyFreeFrom ? r.fullyFreeFrom.getTime() : 0;
        return t(a) - t(b);
      }),
    [rows]
  );

  const totalCapacity = resources.reduce((s, r) => s + r.capacity, 0);
  const weeklyDemand = weeks.map((w) =>
    resources.reduce((s, r) => s + loadFor(r.id, w), 0)
  );
  const peakIdx = weeklyDemand.length
    ? weeklyDemand.indexOf(Math.max(...weeklyDemand))
    : 0;
  const overWeekCount = rows.reduce(
    (n, r) => n + r.frees.filter((f) => f < 0).length,
    0
  );
  const idleWeekCount = rows.reduce(
    (n, r) => n + r.loads.filter((l) => l < r.resource.capacity * 0.5).length,
    0
  );
  const totalFree = rows.reduce((s, r) => s + r.freeTotal, 0);

  // Flattening suggestions
  interface Suggestion {
    from: Resource;
    to: Resource;
    projectName: string;
    moveHours: number;
    weeksLabel: string;
    matchType: "same role" | "same team";
  }

  const suggestions: Suggestion[] = useMemo(() => {
    const out: Suggestion[] = [];
    for (const row of rows) {
      const overIdxs = row.frees
        .map((f, i) => (f < 0 ? i : -1))
        .filter((i) => i >= 0);
      if (!overIdxs.length) continue;
      const myAllocs = allocations.filter((a) => a.resourceId === row.resource.id);
      for (const a of myAllocs) {
        const overlap = overIdxs.filter((i) => hoursInWeek(a, weeks[i]) > 0);
        if (!overlap.length) continue;
        const others = rows.filter((c) => c.resource.id !== row.resource.id);
        const pickBest = (candidates: ResourceRow[]) => {
          let best: { row: ResourceRow; minFree: number } | null = null;
          for (const c of candidates) {
            const minFree = Math.min(...overlap.map((i) => c.frees[i]));
            if (minFree > 0 && (!best || minFree > best.minFree))
              best = { row: c, minFree };
          }
          return best;
        };
        let matchType: Suggestion["matchType"] = "same role";
        let best = pickBest(
          others.filter((c) => c.resource.role === row.resource.role)
        );
        if (!best) {
          matchType = "same team";
          best = pickBest(
            others.filter((c) => c.resource.team === row.resource.team)
          );
        }
        if (!best) continue;
        const moveHours = Math.min(best.minFree, a.hoursPerWeek);
        if (moveHours < 4) continue;
        const first = weeks[overlap[0]];
        const last = weeks[overlap[overlap.length - 1]];
        out.push({
          from: row.resource,
          to: best.row.resource,
          projectName: projectById.get(a.projectId)?.name ?? "Unknown project",
          moveHours,
          weeksLabel:
            overlap.length === 1
              ? `wk of ${formatWeek(first)}`
              : `${formatWeek(first)} – ${formatWeek(last)}`,
          matchType,
        });
      }
    }
    return out.sort((a, b) => b.moveHours - a.moveHours).slice(0, 8);
  }, [rows, allocations, weeks, projectById]);

  // Team summary
  const teams = useMemo(() => {
    const map = new Map<string, { headcount: number; capacity: number; allocated: number }>();
    for (const r of resources) {
      const existing = map.get(r.team) ?? { headcount: 0, capacity: 0, allocated: 0 };
      const allocatedThisWeek = loadFor(r.id, weeks[0]);
      map.set(r.team, {
        headcount: existing.headcount + 1,
        capacity: existing.capacity + r.capacity,
        allocated: existing.allocated + allocatedThisWeek,
      });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [resources, allocations, weeks]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resource reports</h2>
        <p className="text-sm text-muted-foreground">
          Forward availability over the next {HORIZON} weeks — who frees up when, where the
          crunch is, and how to flatten it.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Unallocated hours"
          value={`${totalFree}h`}
          sub={`free capacity, next ${HORIZON} wks`}
          icon={CalendarClock}
        />
        <KpiCard
          title="Overloaded res-wks"
          value={String(overWeekCount)}
          sub="demand above capacity"
          icon={TriangleAlert}
          alert={overWeekCount > 0}
        />
        <KpiCard
          title="Idle res-wks"
          value={String(idleWeekCount)}
          sub="below 50% utilization"
          icon={Layers}
        />
        <KpiCard
          title="Peak demand week"
          value={weeks[peakIdx] ? formatWeek(weeks[peakIdx]) : "—"}
          sub={`${weeklyDemand[peakIdx] ?? 0}h of ${totalCapacity}h capacity`}
          icon={ChartColumn}
        />
      </div>

      {/* Demand vs capacity bar chart */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h3 className="mb-4 text-sm font-semibold">Demand vs. capacity by week</h3>
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {weeks.map((w, i) => {
            const pct = totalCapacity > 0 ? weeklyDemand[i] / totalCapacity : 0;
            const over = pct > 1;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1 self-stretch"
                title={`${formatWeek(w)}: ${weeklyDemand[i]}h of ${totalCapacity}h (${Math.round(pct * 100)}%)`}
              >
                <div className="relative flex w-full flex-1 items-end rounded-sm bg-muted/60">
                  <div
                    className={`w-full rounded-sm ${over ? "bg-red-500" : "bg-primary"}`}
                    style={{ height: `${(Math.min(pct, 1.15) / 1.15) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-foreground/30"
                    style={{ bottom: `${100 / 1.15}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{formatWeek(w)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Dashed line = capacity ({totalCapacity}h/wk). Red bars exceed it.
        </p>
      </div>

      {/* Team summary */}
      {teams.length > 0 && (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Team summary (this week)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Team</th>
                  <th className="px-4 py-2 text-right font-medium">Headcount</th>
                  <th className="px-4 py-2 text-right font-medium">Capacity (h/wk)</th>
                  <th className="px-4 py-2 text-right font-medium">Allocated (h/wk)</th>
                  <th className="px-4 py-2 text-right font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teams.map(([team, stats]) => {
                  const util =
                    stats.capacity > 0
                      ? Math.round((stats.allocated / stats.capacity) * 100)
                      : 0;
                  return (
                    <tr key={team} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{team}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {stats.headcount}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {stats.capacity}h
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {stats.allocated}h
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                          util > 100
                            ? "text-red-600"
                            : util >= 85
                              ? "text-emerald-700"
                              : "text-muted-foreground"
                        }`}
                      >
                        {util}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project budget summary */}
      {projects.length > 0 && (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Project budget health</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Project</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 text-right font-medium">Forecast</th>
                  <th className="px-4 py-2 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => {
                  const forecast = projectForecast(p.id, allocations, resources);
                  const over = !!p.budget && forecast > p.budget;
                  const variance = p.budget ? forecast - p.budget : null;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: p.color }}
                          />
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.status}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {p.budget ? formatCurrency(p.budget) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {forecast > 0 ? formatCurrency(forecast) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                          variance === null
                            ? "text-muted-foreground"
                            : over
                              ? "text-red-600"
                              : "text-emerald-700"
                        }`}
                      >
                        {variance === null
                          ? "—"
                          : `${over ? "+" : ""}${formatCurrency(variance)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* When do people free up */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">When do people free up?</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Resource</th>
                <th className="px-4 py-2 text-right font-medium">Avg util ({HORIZON} wks)</th>
                <th className="px-4 py-2 text-right font-medium">Next {FREE_THRESHOLD}h+ opening</th>
                <th className="px-4 py-2 text-right font-medium">Fully free from</th>
                <th className="px-4 py-2 text-left font-medium">Availability (wk by wk)</th>
                <th className="px-4 py-2 text-right font-medium">Free hrs total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRows.map(
                ({ resource: r, frees, nextOpening, fullyFreeFrom, freeTotal, avgUtil }) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setProfileId(r.id)}
                        className="font-medium hover:underline text-left"
                      >
                        {r.name}
                      </button>
                      <div className="text-xs text-muted-foreground">{r.role}</div>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        avgUtil > 1 ? "font-semibold text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {Math.round(avgUtil * 100)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {nextOpening
                        ? nextOpening.getTime() === weeks[0].getTime()
                          ? "Now"
                          : formatWeek(nextOpening)
                        : `none in ${HORIZON} wks`}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fullyFreeFrom && fullyFreeFrom > weeks[0]
                        ? fullyFreeFrom.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Now"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-0.5">
                        {frees.map((f, i) => (
                          <span
                            key={i}
                            className={`h-4 w-3 rounded-[2px] ${freeCellClass(f, r.capacity)}`}
                            title={`wk of ${formatWeek(weeks[i])}: ${f >= 0 ? `${f}h free` : `${-f}h over`}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {freeTotal}h
                    </td>
                  </tr>
                )
              )}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No resources yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-red-500" /> overloaded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-amber-400" /> fully booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-amber-200" /> tight
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-emerald-300" /> has room
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-emerald-500" /> fully free
          </span>
        </div>
      </div>

      {/* Flattening suggestions */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h3 className="mb-3 text-sm font-semibold">Flattening suggestions</h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No overloads with a same-role peer who has room — nothing to flatten right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  Move <span className="font-semibold tabular-nums">{s.moveHours}h/wk</span> of{" "}
                  <span className="font-medium">{s.projectName}</span> from{" "}
                  <span className="font-medium text-red-600">{s.from.name}</span> →{" "}
                  <span className="font-medium text-emerald-700">{s.to.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.matchType} · overloaded {s.weeksLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Suggestions pair overloaded people with same-role (or same-team) colleagues who have
          spare capacity in the affected weeks. Apply by editing the allocation in Capacity plan.
        </p>
      </div>

      <ResourceProfile resourceId={profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </div>
  );
}
