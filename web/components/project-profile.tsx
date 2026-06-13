"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
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
import {
  type Project,
  type Resource,
  type Allocation,
  usePlanner,
  addWeeks,
  startOfWeek,
  parseLocalDate,
  hoursInWeek,
  allocationCost,
  projectForecast,
  formatCurrency,
  formatDate,
  formatWeek,
  STATUS_COLORS,
} from "@/lib/planner";

interface Props {
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ProjectProfile({ projectId, onOpenChange }: Props) {
  const { projects, resources, allocations } = usePlanner();
  const project = projects.find((p) => p.id === projectId) ?? null;

  return (
    <Sheet open={!!project} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {project && (
          <ProfileBody project={project} resources={resources} allocations={allocations} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function allocationWeeks(a: Allocation): number {
  const start = parseLocalDate(a.startDate);
  const end = parseLocalDate(a.endDate);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
}

function ProfileBody({
  project: p,
  resources,
  allocations,
}: {
  project: Project;
  resources: Resource[];
  allocations: Allocation[];
}) {
  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const projAllocs = useMemo(
    () => allocations.filter((a) => a.projectId === p.id),
    [allocations, p.id]
  );

  const start = startOfWeek(parseLocalDate(p.startDate));
  const end = startOfWeek(parseLocalDate(p.endDate));
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const weekCount = Math.max(Math.round((end.getTime() - start.getTime()) / WEEK_MS) + 1, 1);
  const weeks = Array.from({ length: weekCount }, (_, i) => addWeeks(start, i));

  const weekly = weeks.map((w) =>
    projAllocs.reduce((sum, a) => sum + hoursInWeek(a, w), 0)
  );
  const totalPlanned = weekly.reduce((s, h) => s + h, 0);

  const totalAssigned = projAllocs.reduce((s, a) => s + a.hoursPerWeek * allocationWeeks(a), 0);
  const outsideWindow = totalAssigned - totalPlanned;
  const unstaffedWeeks = weekly.filter((h) => h === 0).length;

  const team = [...new Set(projAllocs.map((a) => a.resourceId))]
    .map((id) => resourceById.get(id))
    .filter((r): r is Resource => !!r);

  const stretchedIds = new Set(
    team
      .filter((r) =>
        weeks.some(
          (w) =>
            allocations
              .filter((a) => a.resourceId === r.id)
              .reduce((s, a) => s + hoursInWeek(a, w), 0) > r.capacity
        )
      )
      .map((r) => r.id)
  );

  const forecast = projectForecast(p.id, allocations, resources);
  const avgFte = totalPlanned / (weekCount * 40);

  const risks: string[] = [];
  if (p.budget && forecast > p.budget)
    risks.push(`Forecast cost exceeds budget by ${formatCurrency(forecast - p.budget)}.`);
  if (unstaffedWeeks > 0)
    risks.push(
      `${unstaffedWeeks} of ${weekCount} project weeks have no one scheduled — the burndown flattens there.`
    );
  if (outsideWindow > 0)
    risks.push(
      `${outsideWindow}h of assigned work is scheduled outside the project dates (allocations overrun the window).`
    );
  if (stretchedIds.size > 0)
    risks.push(
      `${[...stretchedIds]
        .map((id) => resourceById.get(id)?.name)
        .join(", ")} ${stretchedIds.size === 1 ? "is" : "are"} over capacity during this project.`
    );

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-2 pr-8">
        <SheetTitle className="flex items-center gap-2.5">
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          {p.name}
          <Badge variant="secondary" className={STATUS_COLORS[p.status]}>
            {p.status}
          </Badge>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">{p.code}</span>
          <span>·</span>
          <span>{p.manager || "No manager"}</span>
          <span>·</span>
          <span>P{p.priority}</span>
          <span>·</span>
          <span>
            {formatDate(p.startDate)} → {formatDate(p.endDate)} ({weekCount} wks)
          </span>
        </SheetDescription>
        {(p.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(p.tags ?? []).map((t) => (
              <Badge key={t} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </SheetHeader>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Budget" value={p.budget ? formatCurrency(p.budget) : "—"} />
        <Kpi
          label="Forecast cost"
          value={formatCurrency(forecast)}
          tone={p.budget ? (forecast > p.budget ? "bad" : "good") : undefined}
        />
        <Kpi
          label={p.budget ? (forecast > p.budget ? "Over budget" : "Under budget") : "Variance"}
          value={p.budget ? formatCurrency(Math.abs(forecast - p.budget)) : "—"}
          tone={p.budget ? (forecast > p.budget ? "bad" : "good") : undefined}
        />
        <Kpi label="Planned work" value={`${totalPlanned}h`} />
        <Kpi label="Avg staffing" value={`${avgFte.toFixed(1)} FTE`} />
        <Kpi
          label="Team size"
          value={`${team.length} ${team.length === 1 ? "person" : "people"}`}
        />
      </div>

      {/* Burndown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Burndown — scheduled work remaining vs. ideal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalPlanned === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No resources are scheduled within the project dates — nothing to burn down.
            </p>
          ) : (
            <Burndown weeks={weeks} weekly={weekly} total={totalPlanned} color={p.color} />
          )}
        </CardContent>
      </Card>

      {/* Risks */}
      {risks.length > 0 && (
        <div className="space-y-2">
          {risks.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Assigned resources */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Assigned resources</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-1">
          {projAllocs.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No allocations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Resource</TableHead>
                  <TableHead className="text-right">h/wk</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Weeks</TableHead>
                  <TableHead className="pr-6 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projAllocs.map((a) => {
                  const r = resourceById.get(a.resourceId);
                  if (!r) return null;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-1.5 font-medium">
                          {r.name}
                          {stretchedIds.has(r.id) && (
                            <Badge className="bg-red-100 px-1.5 py-0 text-[10px] text-red-800 hover:bg-red-100">
                              over capacity
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.role}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.hoursPerWeek}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(a.startDate)} → {formatDate(a.endDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {allocationWeeks(a)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {r.dayRate ? formatCurrency(allocationCost(a, r)) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {projAllocs.reduce((s, a) => s + a.hoursPerWeek, 0)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="pr-6 text-right font-semibold tabular-nums">
                    {formatCurrency(forecast)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Weekly staffing bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weekly staffing across the project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-px" style={{ height: 64 }}>
            {weekly.map((h, i) => {
              const max = Math.max(...weekly, 1);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${(h / max) * 100}%`,
                    minHeight: h > 0 ? 3 : 0,
                    backgroundColor: h > 0 ? p.color : undefined,
                  }}
                  title={`wk of ${formatWeek(weeks[i])}: ${h}h`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatWeek(weeks[0])}</span>
            <span>{formatWeek(weeks[weeks.length - 1])}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-base font-semibold tabular-nums ${
          tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Burndown({
  weeks,
  weekly,
  total,
  color,
}: {
  weeks: Date[];
  weekly: number[];
  total: number;
  color: string;
}) {
  const W = 600;
  const H = 200;
  const M = { l: 44, r: 10, t: 10, b: 24 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const n = weekly.length;

  const x = (i: number) => M.l + (i / n) * iw;
  const y = (h: number) => M.t + (1 - h / total) * ih;

  let cum = 0;
  const pts = [{ px: x(0), py: y(total) }];
  weekly.forEach((h, i) => {
    cum += h;
    pts.push({ px: x(i + 1), py: y(total - cum) });
  });
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`)
    .join(" ");

  const todayIdx = (Date.now() - weeks[0].getTime()) / (7 * 24 * 60 * 60 * 1000);
  const showToday = todayIdx >= 0 && todayIdx <= n;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={y(total * f)}
              y2={y(total * f)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <text
              x={M.l - 6}
              y={y(total * f) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
            >
              {Math.round(total * f)}h
            </text>
          </g>
        ))}
        <line
          x1={x(0)}
          y1={y(total)}
          x2={x(n)}
          y2={y(0)}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {showToday && (
          <g>
            <line
              x1={x(todayIdx)}
              x2={x(todayIdx)}
              y1={M.t}
              y2={H - M.b}
              stroke="#ef4444"
              strokeWidth="1.5"
            />
            <text x={x(todayIdx) + 4} y={M.t + 10} fontSize="10" fill="#ef4444" fontWeight="600">
              Today
            </text>
          </g>
        )}
        <text x={M.l} y={H - 8} fontSize="10" fill="hsl(var(--muted-foreground))">
          {formatWeek(weeks[0])}
        </text>
        <text
          x={W - M.r}
          y={H - 8}
          textAnchor="end"
          fontSize="10"
          fill="hsl(var(--muted-foreground))"
        >
          {formatWeek(weeks[n - 1])}
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ backgroundColor: color }} />
          scheduled burn ({total}h total)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t border-dashed border-muted-foreground" />
          ideal
        </span>
      </div>
    </div>
  );
}
