"use client";

import useSWR, { mutate } from "swr";
import { useMemo } from "react";
import { TriangleAlert, Briefcase, Gauge, Users, Wallet } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  priority: 1 | 2 | 3;
  color: string;
  startDate: string;
  endDate: string;
  manager?: string;
  budget?: number | null;
  tags?: string[];
}

interface Resource {
  id: string;
  name: string;
  role: string;
  team: string;
  capacity: number;
  dayRate?: number | null;
  avatarUrl?: string;
  tags?: string[];
}

interface Allocation {
  id: string;
  projectId: string;
  resourceId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normaliseProject(r: Record<string, unknown>): Project {
  return { ...(r as unknown as Project), priority: Number(r.priority) as 1 | 2 | 3, budget: r.budget != null ? Number(r.budget) : null };
}

function normaliseResource(r: Record<string, unknown>): Resource {
  return { ...(r as unknown as Resource), capacity: Number(r.capacity), dayRate: r.dayRate != null ? Number(r.dayRate) : null };
}

function normaliseAllocation(r: Record<string, unknown>): Allocation {
  return { ...(r as unknown as Allocation), hoursPerWeek: Number(r.hoursPerWeek) };
}

// ── SWR hooks ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function usePlanner() {
  const { data: projectsRaw, isLoading: p } = useSWR<unknown[]>("/api/projects", fetcher);
  const { data: resourcesRaw, isLoading: r } = useSWR<unknown[]>("/api/resources", fetcher);
  const { data: allocationsRaw, isLoading: a } = useSWR<unknown[]>("/api/allocations", fetcher);

  return {
    projects: (projectsRaw ?? []).map((r) => normaliseProject(r as Record<string, unknown>)),
    resources: (resourcesRaw ?? []).map((r) => normaliseResource(r as Record<string, unknown>)),
    allocations: (allocationsRaw ?? []).map((r) => normaliseAllocation(r as Record<string, unknown>)),
    isLoading: p || r || a,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(d: Date): Date {
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = b.getDay();
  b.setDate(b.getDate() + (dow === 0 ? -6 : 1 - dow));
  return b;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hoursInWeek(alloc: Allocation, week: Date): number {
  const weekEnd = new Date(week);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const start = parseLocalDate(alloc.startDate);
  const end = parseLocalDate(alloc.endDate);
  return start <= weekEnd && end >= week ? alloc.hoursPerWeek : 0;
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function buildWeeks(base: Date): Date[] {
  const monday = startOfWeek(base);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7 * i);
    return d;
  });
}

// ── Card primitives ───────────────────────────────────────────────────────────

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      data-slot="card"
      className={`group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="card-header" className={`px-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="card-title" className={`font-medium ${className ?? ""}`}>
      {children}
    </div>
  );
}

function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-slot="card-content" className={`px-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { projects, resources, allocations, isLoading } = usePlanner();

  const today = useMemo(() => startOfWeek(new Date()), []);
  const weeks = useMemo(() => buildWeeks(new Date()), []);

  const resourceHours = (resourceId: string, week: Date) =>
    allocations.filter((a) => a.resourceId === resourceId).reduce((sum, a) => sum + hoursInWeek(a, week), 0);

  const activeProjects = projects.filter((p) => p.status === "Active");
  const totalCapacity = resources.reduce((s, r) => s + r.capacity, 0);
  const totalAllocated = resources.reduce((s, r) => s + resourceHours(r.id, today), 0);
  const utilization = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  const overAllocations = resources.flatMap((r) =>
    weeks
      .map((w) => ({ resource: r, week: w, hours: resourceHours(r.id, w) }))
      .filter((x) => x.hours > r.capacity)
  );

  const projectForecast = projects
    .filter((p) => p.status !== "Completed")
    .map((p) => {
      const resourceMap = new Map(resources.map((r) => [r.id, r]));
      const forecast = allocations
        .filter((a) => a.projectId === p.id)
        .reduce((sum, a) => {
          const res = resourceMap.get(a.resourceId);
          const rate = res?.dayRate ?? 0;
          const s = startOfWeek(parseLocalDate(a.startDate)).getTime();
          const e = startOfWeek(parseLocalDate(a.endDate)).getTime();
          const weeks = e < s ? 0 : Math.round((e - s) / 604800000) + 1;
          return sum + weeks * (a.hoursPerWeek / 8) * rate;
        }, 0);
      return { project: p, forecast };
    })
    .sort((a, b) => {
      const pct = (x: { project: Project; forecast: number }) =>
        x.project.budget ? x.forecast / x.project.budget : -1;
      return pct(b) - pct(a);
    });

  const overBudgetCount = projectForecast.filter(
    (x) => x.project.budget && x.forecast > x.project.budget
  ).length;

  const staffingByProject = projects
    .filter((p) => p.status !== "Completed")
    .map((p) => ({
      project: p,
      hours: allocations.filter((a) => a.projectId === p.id).reduce((s, a) => s + hoursInWeek(a, today), 0),
    }))
    .sort((a, b) => b.hours - a.hours);

  const maxStaffingHours = Math.max(1, ...staffingByProject.map((x) => x.hours));

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
        <h2 className="text-lg font-semibold">Portfolio overview</h2>
        <p className="text-sm text-muted-foreground">
          Week of {formatDate(today)} — demand vs. capacity at a glance.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground">{projects.length} total in portfolio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resources</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{resources.length}</div>
            <p className="text-xs text-muted-foreground">{totalCapacity}h weekly capacity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilization (this wk)</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{utilization}%</div>
            <p className="text-xs text-muted-foreground">
              {totalAllocated}h allocated of {totalCapacity}h
            </p>
          </CardContent>
        </Card>

        <Card className={overAllocations.length > 0 ? "border-red-300" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overallocations</CardTitle>
            <TriangleAlert
              className={`h-4 w-4 ${overAllocations.length > 0 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{overAllocations.length}</div>
            <p className="text-xs text-muted-foreground">resource-weeks over capacity (12 wks)</p>
          </CardContent>
        </Card>

        <Card className={overBudgetCount > 0 ? "border-red-300" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Over budget</CardTitle>
            <Wallet
              className={`h-4 w-4 ${overBudgetCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{overBudgetCount}</div>
            <p className="text-xs text-muted-foreground">projects forecast over their budget</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staffing by project — this week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffingByProject.map(({ project, hours }) => (
              <div key={project.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {hours}h · {(hours / 40).toFixed(1)} FTE
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(hours / maxStaffingHours) * 100}%`,
                      backgroundColor: project.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {staffingByProject.length === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget health — full allocation forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectForecast.map(({ project, forecast }) => {
              const over = !!project.budget && forecast > project.budget;
              const pct = project.budget ? Math.min((forecast / project.budget) * 100, 100) : 0;
              return (
                <div key={project.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </span>
                    {project.budget ? (
                      <span className={`tabular-nums ${over ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                        {formatCurrency(forecast)} / {formatCurrency(project.budget)}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(forecast)} / no budget
                      </span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: project.budget ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
              );
            })}
            {projectForecast.length === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overallocation alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {overAllocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one is booked over capacity in the next 12 weeks.
              </p>
            ) : (
              <ul className="space-y-2">
                {overAllocations.slice(0, 8).map((x, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{x.resource.name}</span>{" "}
                      <span className="text-muted-foreground">wk of {formatDate(x.week)}</span>
                    </span>
                    <span className="tabular-nums font-semibold text-red-700">
                      {x.hours}h / {x.resource.capacity}h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
