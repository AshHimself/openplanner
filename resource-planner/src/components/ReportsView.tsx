import { useMemo, useState } from "react";
import { CalendarClock, ChartColumn, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePlanner } from "@/store";
import type { Allocation, Resource } from "@/types";
import { ResourceProfile } from "@/components/ResourceProfile";
import {
  addDays,
  allocationHoursInWeek,
  formatWeek,
  getWeeks,
  parseISO,
  startOfWeek,
} from "@/lib/dates";

const HORIZON = 12;
const FREE_THRESHOLD = 8; // hours/week considered a meaningful opening

export function ReportsView() {
  const { resources, projects, allocations } = usePlanner();
  const [profileId, setProfileId] = useState<string | null>(null);
  const weeks = useMemo(() => getWeeks(HORIZON), []);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const loadFor = (resourceId: string, week: Date) =>
    allocations
      .filter((a) => a.resourceId === resourceId)
      .reduce((sum, a) => sum + allocationHoursInWeek(a, week), 0);

  interface ResourceRow {
    resource: Resource;
    loads: number[]; // per horizon week
    frees: number[];
    nextOpening: Date | null; // first week with >= FREE_THRESHOLD free
    fullyFreeFrom: Date | null; // Monday after last allocation ends; null = now
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
        const lastEnd = myAllocs.length
          ? myAllocs.reduce(
              (max, a) => (parseISO(a.endDate) > max ? parseISO(a.endDate) : max),
              parseISO(myAllocs[0].endDate)
            )
          : null;
        const freeTotal = frees.reduce((s, f) => s + Math.max(f, 0), 0);
        const avgUtil =
          r.capacity > 0 ? loads.reduce((s, l) => s + l, 0) / (r.capacity * HORIZON) : 0;
        return {
          resource: r,
          loads,
          frees,
          nextOpening: nextIdx >= 0 ? weeks[nextIdx] : null,
          fullyFreeFrom: lastEnd ? addDays(startOfWeek(lastEnd), 7) : null,
          freeTotal,
          avgUtil,
        };
      }),
    [resources, allocations, weeks]
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const t = (r: ResourceRow) =>
          r.fullyFreeFrom ? r.fullyFreeFrom.getTime() : 0; // already free first
        return t(a) - t(b);
      }),
    [rows]
  );

  // Portfolio demand vs capacity per week
  const totalCapacity = resources.reduce((s, r) => s + r.capacity, 0);
  const weeklyDemand = weeks.map((w) =>
    resources.reduce((s, r) => s + loadFor(r.id, w), 0)
  );
  const peakIdx = weeklyDemand.indexOf(Math.max(...weeklyDemand));
  const overWeekCount = rows.reduce(
    (n, r) => n + r.frees.filter((f) => f < 0).length,
    0
  );
  const idleWeekCount = rows.reduce(
    (n, r) => n + r.loads.filter((l) => l < r.resource.capacity * 0.5).length,
    0
  );
  const totalFree = rows.reduce((s, r) => s + r.freeTotal, 0);

  // Flattening suggestions: move work from overloaded people to same-role peers with room
  interface Suggestion {
    from: Resource;
    to: Resource;
    allocation: Allocation;
    projectName: string;
    moveHours: number;
    weeksLabel: string;
    matchType: "same role" | "same team";
  }
  const suggestions: Suggestion[] = useMemo(() => {
    const out: Suggestion[] = [];
    const pickBest = (candidates: ResourceRow[], overlap: number[]) => {
      let best: { row: ResourceRow; minFree: number } | null = null;
      for (const c of candidates) {
        const minFree = Math.min(...overlap.map((i) => c.frees[i]));
        if (minFree > 0 && (!best || minFree > best.minFree)) best = { row: c, minFree };
      }
      return best;
    };
    for (const row of rows) {
      const overIdxs = row.frees
        .map((f, i) => (f < 0 ? i : -1))
        .filter((i) => i >= 0);
      if (overIdxs.length === 0) continue;
      const myAllocs = allocations.filter((a) => a.resourceId === row.resource.id);
      for (const a of myAllocs) {
        const overlap = overIdxs.filter((i) => allocationHoursInWeek(a, weeks[i]) > 0);
        if (overlap.length === 0) continue;
        const others = rows.filter((c) => c.resource.id !== row.resource.id);
        let matchType: Suggestion["matchType"] = "same role";
        let best = pickBest(others.filter((c) => c.resource.role === row.resource.role), overlap);
        if (!best) {
          matchType = "same team";
          best = pickBest(others.filter((c) => c.resource.team === row.resource.team), overlap);
        }
        if (!best) continue;
        const moveHours = Math.min(best.minFree, a.hoursPerWeek);
        if (moveHours < 4) continue;
        const first = weeks[overlap[0]];
        const last = weeks[overlap[overlap.length - 1]];
        out.push({
          from: row.resource,
          to: best.row.resource,
          allocation: a,
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

  function freeCellClass(free: number, capacity: number): string {
    if (free < 0) return "bg-red-500";
    if (free === 0) return "bg-amber-400";
    if (free < capacity * 0.25) return "bg-amber-200";
    if (free < capacity) return "bg-emerald-300";
    return "bg-emerald-500";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unallocated hours
            </CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{totalFree}h</div>
            <p className="text-xs text-muted-foreground">free capacity, next {HORIZON} wks</p>
          </CardContent>
        </Card>
        <Card className={overWeekCount > 0 ? "border-red-300" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overloaded res-wks
            </CardTitle>
            <Layers className={`h-4 w-4 ${overWeekCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{overWeekCount}</div>
            <p className="text-xs text-muted-foreground">demand above capacity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Idle res-wks
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{idleWeekCount}</div>
            <p className="text-xs text-muted-foreground">below 50% utilization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peak demand week
            </CardTitle>
            <ChartColumn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatWeek(weeks[peakIdx])}
            </div>
            <p className="text-xs text-muted-foreground">
              {weeklyDemand[peakIdx]}h of {totalCapacity}h capacity
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demand vs. capacity by week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {weeks.map((w, i) => {
              const pct = totalCapacity > 0 ? weeklyDemand[i] / totalCapacity : 0;
              const over = pct > 1;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1 self-stretch">
                  <div className="relative flex w-full flex-1 items-end rounded-sm bg-muted/60">
                    <div
                      className={`w-full rounded-sm ${over ? "bg-red-500" : "bg-primary"}`}
                      style={{ height: `${Math.min(pct, 1.15) * 100 / 1.15}%` }}
                      title={`${weeklyDemand[i]}h of ${totalCapacity}h (${Math.round(pct * 100)}%)`}
                    />
                    {/* capacity line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-foreground/40"
                      style={{ bottom: `${100 / 1.15}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatWeek(w)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dashed line = total capacity ({totalCapacity}h/wk). Red bars exceed it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When do people free up?</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Resource</TableHead>
                <TableHead>Avg util ({HORIZON} wks)</TableHead>
                <TableHead>Next {FREE_THRESHOLD}h+ opening</TableHead>
                <TableHead>Fully free from</TableHead>
                <TableHead>Availability (wk by wk)</TableHead>
                <TableHead className="pr-6 text-right">Free hrs total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map(({ resource: r, frees, nextOpening, fullyFreeFrom, freeTotal, avgUtil }) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6">
                    <button
                      className="font-medium hover:underline"
                      onClick={() => setProfileId(r.id)}
                    >
                      {r.name}
                    </button>
                    <div className="text-xs text-muted-foreground">{r.role}</div>
                  </TableCell>
                  <TableCell
                    className={`tabular-nums ${avgUtil > 1 ? "font-semibold text-red-600" : ""}`}
                  >
                    {Math.round(avgUtil * 100)}%
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {nextOpening
                      ? nextOpening.getTime() === weeks[0].getTime()
                        ? "Now"
                        : formatWeek(nextOpening)
                      : `none in ${HORIZON} wks`}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fullyFreeFrom
                      ? fullyFreeFrom <= weeks[0]
                        ? "Now"
                        : fullyFreeFrom.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                      : "Now"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {frees.map((f, i) => (
                        <span
                          key={i}
                          className={`h-4 w-3 rounded-[2px] ${freeCellClass(f, r.capacity)}`}
                          title={`wk of ${formatWeek(weeks[i])}: ${f >= 0 ? `${f}h free` : `${-f}h over`}`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{freeTotal}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-4 border-t px-6 py-2.5 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flattening suggestions</CardTitle>
        </CardHeader>
        <CardContent>
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
            spare capacity in the affected weeks. Apply one by editing the allocation in the
            Capacity plan.
          </p>
        </CardContent>
      </Card>

      <ResourceProfile resourceId={profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </div>
  );
}
