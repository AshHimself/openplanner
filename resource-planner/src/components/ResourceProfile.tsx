import { useMemo } from "react";
import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import type { Allocation, Project, Resource } from "@/types";
import {
  addWeeks,
  allocationHoursInWeek,
  formatDate,
  formatWeek,
  parseISO,
  startOfWeek,
  toISO,
} from "@/lib/dates";
import { allocationCost, allocationWeeks, fmtCurrency } from "@/lib/costs";
import { statusBadgeClass } from "@/lib/status";

const MIN_WEEKS = 12;
const MAX_WEEKS = 26;
const FREE_THRESHOLD = 8;

interface Props {
  resourceId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ResourceProfile({ resourceId, onOpenChange }: Props) {
  const { resources, projects, allocations } = usePlanner();
  const resource = resources.find((r) => r.id === resourceId) ?? null;

  return (
    <Sheet open={!!resource} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {resource && (
          <ProfileBody resource={resource} projects={projects} allocations={allocations} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProfileBody({
  resource: r,
  projects,
  allocations,
}: {
  resource: Resource;
  projects: Project[];
  allocations: Allocation[];
}) {
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const myAllocs = useMemo(
    () => allocations.filter((a) => a.resourceId === r.id),
    [allocations, r.id]
  );

  // Horizon: from this week until the last assignment ends (+2 wks of visible "free" runway)
  const currentMonday = startOfWeek(new Date());
  const lastEnd = myAllocs.reduce<Date | null>((max, a) => {
    const e = parseISO(a.endDate);
    return !max || e > max ? e : max;
  }, null);
  const horizonWeeks = lastEnd
    ? Math.min(
        Math.max(
          Math.round((startOfWeek(lastEnd).getTime() - currentMonday.getTime()) / (7 * 864e5)) + 3,
          MIN_WEEKS
        ),
        MAX_WEEKS
      )
    : MIN_WEEKS;
  const weeks = Array.from({ length: horizonWeeks }, (_, i) => addWeeks(currentMonday, i));

  // Per-week, per-project stacked load
  const weeklyStacks = weeks.map((w) => {
    const segments = myAllocs
      .map((a) => ({
        project: projectById.get(a.projectId),
        hours: allocationHoursInWeek(a, w),
      }))
      .filter((s) => s.hours > 0 && s.project);
    const total = segments.reduce((s, x) => s + x.hours, 0);
    return { week: w, segments, total };
  });

  const totalLoads = weeklyStacks.map((s) => s.total);
  const avgUtil =
    r.capacity > 0
      ? totalLoads.slice(0, MIN_WEEKS).reduce((s, l) => s + l, 0) / (r.capacity * MIN_WEEKS)
      : 0;
  const freeTotal = totalLoads
    .slice(0, MIN_WEEKS)
    .reduce((s, l) => s + Math.max(r.capacity - l, 0), 0);

  // When do they free up?
  const fullyFreeIdx = (() => {
    // first week from which everything after is 0 too
    for (let i = 0; i < totalLoads.length; i++) {
      if (totalLoads.slice(i).every((l) => l === 0)) return i;
    }
    return -1;
  })();
  const fullyFreeDate = lastEnd ? addWeeks(startOfWeek(lastEnd), 1) : currentMonday;
  const fullyFreeNow = !lastEnd || fullyFreeDate <= currentMonday;
  const nextOpeningIdx = totalLoads.findIndex((l) => r.capacity - l >= FREE_THRESHOLD);

  const activeProjects = [...new Set(myAllocs.map((a) => a.projectId))]
    .map((id) => projectById.get(id))
    .filter((p): p is Project => !!p);

  const bookedValue = myAllocs.reduce((s, a) => s + allocationCost(a, r), 0);

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-2 pr-8">
        <SheetTitle className="flex items-center gap-2.5">
          {r.name}
          <Badge variant="secondary">{r.role}</Badge>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{r.team} team</span>
          <span>·</span>
          <span>{r.capacity}h/wk capacity</span>
          <span>·</span>
          <span>{r.dayRate ? `${fmtCurrency(r.dayRate)}/day` : "no day rate"}</span>
        </SheetDescription>
      </SheetHeader>

      {/* Availability headline */}
      <div
        className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
          fullyFreeNow
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-border bg-muted/50"
        }`}
      >
        <CalendarCheck
          className={`h-4 w-4 shrink-0 ${fullyFreeNow ? "text-emerald-600" : "text-muted-foreground"}`}
        />
        {fullyFreeNow ? (
          <span className="font-medium">Fully available now.</span>
        ) : (
          <span>
            <span className="font-medium">Fully free from {formatDate(toISO(fullyFreeDate))}.</span>{" "}
            {nextOpeningIdx >= 0 && (
              <span className="text-muted-foreground">
                Next {FREE_THRESHOLD}h+ opening:{" "}
                {nextOpeningIdx === 0 ? "this week" : `wk of ${formatWeek(weeks[nextOpeningIdx])}`}.
              </span>
            )}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label={`Avg utilization (${MIN_WEEKS} wks)`} value={`${Math.round(avgUtil * 100)}%`} tone={avgUtil > 1 ? "bad" : undefined} />
        <Kpi label={`Free hours (${MIN_WEEKS} wks)`} value={`${freeTotal}h`} />
        <Kpi label="Booked value (all work)" value={r.dayRate ? fmtCurrency(bookedValue) : "—"} />
      </div>

      {/* Load chart: stacked by project, capacity line, free-from marker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workload by week — colored by project</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadChart
            weeks={weeks}
            stacks={weeklyStacks}
            capacity={r.capacity}
            fullyFreeIdx={fullyFreeIdx}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {activeProjects.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t border-dashed border-foreground/50" />
              capacity ({r.capacity}h)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Project assignments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Project assignments</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-1">
          {myAllocs.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No assignments — fully available.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Project</TableHead>
                  <TableHead className="text-right">h/wk</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Weeks</TableHead>
                  <TableHead className="pr-6 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAllocs.map((a) => {
                  const p = projectById.get(a.projectId);
                  if (!p) return null;
                  const ended = parseISO(a.endDate) < currentMonday;
                  return (
                    <TableRow key={a.id} className={ended ? "opacity-50" : ""}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2 font-medium">
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} />
                          {p.name}
                          <Badge variant="secondary" className={`px-1.5 py-0 text-[10px] ${statusBadgeClass(p.status)}`}>
                            {p.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.hoursPerWeek}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(a.startDate)} → {formatDate(a.endDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{allocationWeeks(a)}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {r.dayRate ? fmtCurrency(allocationCost(a, r)) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone === "bad" ? "text-red-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function LoadChart({
  weeks,
  stacks,
  capacity,
  fullyFreeIdx,
}: {
  weeks: Date[];
  stacks: { week: Date; segments: { project?: Project; hours: number }[]; total: number }[];
  capacity: number;
  fullyFreeIdx: number;
}) {
  const maxY = Math.max(capacity * 1.25, ...stacks.map((s) => s.total), 1);
  const H = 140;
  const capY = (capacity / maxY) * 100;

  return (
    <div>
      <div className="relative" style={{ height: H }}>
        {/* capacity line */}
        <div
          className="absolute left-0 right-0 z-10 border-t border-dashed border-foreground/50"
          style={{ bottom: `${capY}%` }}
        />
        {/* free-from marker */}
        {fullyFreeIdx > 0 && (
          <div
            className="absolute bottom-0 top-0 z-10 border-l-2 border-emerald-500"
            style={{ left: `${(fullyFreeIdx / weeks.length) * 100}%` }}
          >
            <span className="absolute -top-1 left-1 whitespace-nowrap rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              free
            </span>
          </div>
        )}
        {/* stacked bars */}
        <div className="flex h-full items-end gap-px">
          {stacks.map((s, i) => {
            const over = s.total > capacity;
            return (
              <div
                key={i}
                className={`flex flex-1 flex-col-reverse overflow-hidden rounded-t-sm ${over ? "ring-2 ring-red-400" : ""}`}
                style={{ height: `${(s.total / maxY) * 100}%` }}
                title={`wk of ${formatWeek(weeks[i])}: ${s.total}h of ${capacity}h${
                  over ? " — OVERBOOKED" : ""
                }`}
              >
                {s.segments.map((seg, j) => (
                  <div
                    key={j}
                    style={{
                      height: `${s.total > 0 ? (seg.hours / s.total) * 100 : 0}%`,
                      backgroundColor: seg.project?.color,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatWeek(weeks[0])}</span>
        <span>{formatWeek(weeks[Math.floor(weeks.length / 2)])}</span>
        <span>{formatWeek(weeks[weeks.length - 1])}</span>
      </div>
    </div>
  );
}
