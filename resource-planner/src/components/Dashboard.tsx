import { useMemo } from "react";
import { AlertTriangle, Briefcase, Gauge, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanner } from "@/store";
import { allocationHoursInWeek, formatWeek, getWeeks, startOfWeek } from "@/lib/dates";
import { fmtCurrency, projectForecast } from "@/lib/costs";

export function Dashboard({ onGoToCapacity }: { onGoToCapacity: () => void }) {
  const { projects, resources, allocations } = usePlanner();
  const thisWeek = useMemo(() => startOfWeek(new Date()), []);
  const weeks = useMemo(() => getWeeks(12), []);

  const activeProjects = projects.filter((p) => p.status === "Active");

  const loadFor = (resourceId: string, week: Date) =>
    allocations
      .filter((a) => a.resourceId === resourceId)
      .reduce((sum, a) => sum + allocationHoursInWeek(a, week), 0);

  const totalCapacity = resources.reduce((s, r) => s + r.capacity, 0);
  const totalAllocated = resources.reduce((s, r) => s + loadFor(r.id, thisWeek), 0);
  const utilization = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  // Every (resource, week) cell over capacity in the horizon
  const conflicts = resources.flatMap((r) =>
    weeks
      .map((w) => ({ resource: r, week: w, hours: loadFor(r.id, w) }))
      .filter((c) => c.hours > r.capacity)
  );

  const budgetHealth = projects
    .filter((p) => p.status !== "Completed")
    .map((p) => ({ project: p, forecast: projectForecast(p.id, allocations, resources) }))
    .sort((a, b) => {
      const ratio = (x: typeof a) => (x.project.budget ? x.forecast / x.project.budget : -1);
      return ratio(b) - ratio(a);
    });
  const overBudgetCount = budgetHealth.filter(
    (b) => b.project.budget && b.forecast > b.project.budget
  ).length;

  const projectStaffing = projects
    .filter((p) => p.status !== "Completed")
    .map((p) => {
      const hours = allocations
        .filter((a) => a.projectId === p.id)
        .reduce((sum, a) => sum + allocationHoursInWeek(a, thisWeek), 0);
      return { project: p, hours };
    })
    .sort((a, b) => b.hours - a.hours);
  const maxHours = Math.max(1, ...projectStaffing.map((s) => s.hours));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Portfolio overview</h2>
        <p className="text-sm text-muted-foreground">
          Week of {formatWeek(thisWeek)} — demand vs. capacity at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active projects
            </CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilization (this wk)
            </CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{utilization}%</div>
            <p className="text-xs text-muted-foreground">
              {totalAllocated}h allocated of {totalCapacity}h
            </p>
          </CardContent>
        </Card>
        <Card className={conflicts.length > 0 ? "border-red-300" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overallocations
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${conflicts.length > 0 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{conflicts.length}</div>
            <p className="text-xs text-muted-foreground">resource-weeks over capacity (12 wks)</p>
          </CardContent>
        </Card>
        <Card className={overBudgetCount > 0 ? "border-red-300" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Over budget
            </CardTitle>
            <Wallet
              className={`h-4 w-4 ${overBudgetCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{overBudgetCount}</div>
            <p className="text-xs text-muted-foreground">
              projects forecast over their budget
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staffing by project — this week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectStaffing.map(({ project, hours }) => (
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
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(hours / maxHours) * 100}%`,
                      backgroundColor: project.color,
                    }}
                  />
                </div>
              </div>
            ))}
            {projectStaffing.length === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget health — full allocation forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetHealth.map(({ project, forecast }) => {
              const budget = project.budget;
              const over = budget ? forecast > budget : false;
              const pct = budget ? Math.min((forecast / budget) * 100, 100) : 0;
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
                    {budget ? (
                      <span
                        className={`tabular-nums ${over ? "font-semibold text-red-600" : "text-muted-foreground"}`}
                      >
                        {fmtCurrency(forecast)} / {fmtCurrency(budget)}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        {fmtCurrency(forecast)} / no budget
                      </span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: budget ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
              );
            })}
            {budgetHealth.length === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overallocation alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one is booked over capacity in the next 12 weeks.
              </p>
            ) : (
              <ul className="space-y-2">
                {conflicts.slice(0, 8).map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{c.resource.name}</span>{" "}
                      <span className="text-muted-foreground">wk of {formatWeek(c.week)}</span>
                    </span>
                    <span className="tabular-nums font-semibold text-red-700">
                      {c.hours}h / {c.resource.capacity}h
                    </span>
                  </li>
                ))}
                {conflicts.length > 8 && (
                  <li>
                    <button
                      className="text-sm text-teal-700 hover:underline"
                      onClick={onGoToCapacity}
                    >
                      View all {conflicts.length} in the capacity plan →
                    </button>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
