import {
  type Project,
  type Resource,
  type Allocation,
  type Requirement,
  startOfWeek,
  addWeeks,
  toISO,
  parseLocalDate,
  hoursInWeek,
  STANDARD_WEEK_HOURS,
} from "./planner";

// ---- Output shapes ----

export interface SupplyDemandCell {
  supplyFte: number;
  demandFte: number;
}

export interface RoleRow {
  role: string;
  cells: SupplyDemandCell[]; // one per week
  hasNoResources: boolean; // demand exists but zero resources of this role anywhere
  totalDeficit: number; // sum of max(0, demand-supply) across weeks
}

export interface TimelineCell {
  allocatedHours: number; // current real allocations
  freeHours: number; // capacity - allocated
  proposedProjectId: string | null; // ghost assignment from matching
  proposedFte: number;
}

export interface ResourceRow {
  resourceId: string;
  name: string;
  role: string;
  capacity: number;
  cells: TimelineCell[];
}

export interface GapPeriod {
  role: string;
  projectId: string;
  projectName: string;
  startWeek: string;
  endWeek: string;
  weeks: number;
  shortfallFte: number; // peak weekly shortfall over the period
  noResourcesOfRole: boolean;
}

export interface Forecast {
  weeks: string[]; // week-start ISO dates
  roles: string[];
  roleRows: RoleRow[];
  resourceRows: ResourceRow[];
  gaps: GapPeriod[];
}

const norm = (s: string) => s.trim().toLowerCase();

function projectActiveInWeek(p: Project, weekStart: Date): boolean {
  const weekEnd = addWeeks(weekStart, 1);
  const start = parseLocalDate(p.startDate);
  const end = parseLocalDate(p.endDate);
  return start < weekEnd && end >= weekStart;
}

// A resource is available in a week if it falls within their start/end window.
// Null bounds mean "always available" on that side.
function resourceActiveInWeek(r: Resource, weekStart: Date): boolean {
  const weekEnd = addWeeks(weekStart, 1);
  if (r.startDate && parseLocalDate(r.startDate) >= weekEnd) return false;
  if (r.endDate && parseLocalDate(r.endDate) < weekStart) return false;
  return true;
}

export interface ForecastInput {
  fromDate: string; // ISO; forecast begins at the start of this week
  horizonWeeks: number;
  projects: Project[];
  resources: Resource[];
  allocations: Allocation[];
  requirements: Requirement[];
}

export function buildForecast({
  fromDate,
  horizonWeeks,
  projects,
  resources,
  allocations,
  requirements,
}: ForecastInput): Forecast {
  const start = startOfWeek(parseLocalDate(fromDate));
  const weekDates = Array.from({ length: horizonWeeks }, (_, i) => addWeeks(start, i));
  const weeks = weekDates.map(toISO);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  // Roles present across requirements + resources
  const roleSet = new Set<string>();
  requirements.forEach((r) => roleSet.add(r.role));
  resources.forEach((r) => roleSet.add(r.role));
  const roles = [...roleSet].sort((a, b) => a.localeCompare(b));

  // Resources that exist per normalised role (for "no resources of role" detection)
  const resourcesByRole = new Map<string, Resource[]>();
  for (const res of resources) {
    const k = norm(res.role);
    if (!resourcesByRole.has(k)) resourcesByRole.set(k, []);
    resourcesByRole.get(k)!.push(res);
  }

  // ---- Per-resource free capacity per week (captures roll-off) ----
  const resourceRows: ResourceRow[] = resources.map((res) => {
    const cells: TimelineCell[] = weekDates.map((w) => {
      const active = resourceActiveInWeek(res, w);
      const allocatedHours = allocations
        .filter((a) => a.resourceId === res.id)
        .reduce((s, a) => s + hoursInWeek(a, w), 0);
      // Outside the resource's availability window they contribute no free capacity.
      const freeHours = active ? Math.max(0, res.capacity - allocatedHours) : 0;
      return { allocatedHours, freeHours, proposedProjectId: null, proposedFte: 0 };
    });
    return {
      resourceId: res.id,
      name: res.name,
      role: res.role,
      capacity: res.capacity,
      cells,
    };
  });
  const rowByResourceId = new Map(resourceRows.map((r) => [r.resourceId, r]));

  // ---- Demand per role per week (from requirements over project windows) ----
  // demand[roleNorm][weekIndex] = total fte
  const demand = new Map<string, number[]>();
  for (const role of roles) demand.set(norm(role), new Array(horizonWeeks).fill(0));

  weekDates.forEach((w, wi) => {
    for (const req of requirements) {
      const p = projectById.get(req.projectId);
      if (!p) continue;
      if (!projectActiveInWeek(p, w)) continue;
      const k = norm(req.role);
      if (!demand.has(k)) demand.set(k, new Array(horizonWeeks).fill(0));
      demand.get(k)![wi] += req.fte;
    }
  });

  // ---- Greedy matching per week → proposed assignments + per-requirement shortfall ----
  // shortfall tracking keyed by `${roleNorm}|${projectId}` → per-week shortfall fte
  const shortfall = new Map<string, number[]>();

  weekDates.forEach((w, wi) => {
    // remaining free FTE per resource this week
    const remainingFte = new Map<string, number>();
    for (const row of resourceRows) {
      remainingFte.set(row.resourceId, row.cells[wi].freeHours / STANDARD_WEEK_HOURS);
    }

    // requirements active this week, highest-priority projects first
    const activeReqs = requirements
      .filter((req) => {
        const p = projectById.get(req.projectId);
        return p && projectActiveInWeek(p, w);
      })
      .sort((a, b) => {
        const pa = projectById.get(a.projectId)!;
        const pb = projectById.get(b.projectId)!;
        return pa.priority - pb.priority; // P1 first
      });

    for (const req of activeReqs) {
      let need = req.fte;
      const reqTags = req.tags ?? [];

      // candidate resources: matching role, sharing ≥1 tag if tags specified
      const candidates = resourceRows
        .filter((row) => norm(row.role) === norm(req.role))
        .map((row) => {
          const res = resources.find((r) => r.id === row.resourceId)!;
          const overlap = reqTags.length
            ? (res.tags ?? []).filter((t) => reqTags.includes(t)).length
            : 0;
          return { row, overlap, free: remainingFte.get(row.resourceId) ?? 0 };
        })
        .filter((c) => c.free > 0)
        .filter((c) => (reqTags.length ? c.overlap > 0 : true))
        .sort((a, b) => b.overlap - a.overlap || b.free - a.free);

      for (const c of candidates) {
        if (need <= 0.001) break;
        const take = Math.min(c.free, need);
        if (take <= 0) continue;
        need -= take;
        remainingFte.set(c.row.resourceId, c.free - take);
        // record proposed assignment (dominant project = largest share wins display)
        const cell = c.row.cells[wi];
        if (take > cell.proposedFte) cell.proposedProjectId = req.projectId;
        cell.proposedFte += take;
      }

      // record shortfall for this requirement this week
      const key = `${norm(req.role)}|${req.projectId}`;
      if (!shortfall.has(key)) shortfall.set(key, new Array(horizonWeeks).fill(0));
      shortfall.get(key)![wi] += Math.max(0, need);
    }
  });

  // ---- Role supply/demand rows (heatmap) ----
  const roleRows: RoleRow[] = roles.map((role) => {
    const k = norm(role);
    const demandArr = demand.get(k) ?? new Array(horizonWeeks).fill(0);
    const cells: SupplyDemandCell[] = weekDates.map((w, wi) => {
      const supplyFte = resourceRows
        .filter((row) => norm(row.role) === k)
        .reduce((s, row) => s + row.cells[wi].freeHours / STANDARD_WEEK_HOURS, 0);
      return { supplyFte, demandFte: demandArr[wi] };
    });
    const totalDeficit = cells.reduce((s, c) => s + Math.max(0, c.demandFte - c.supplyFte), 0);
    const hasDemand = demandArr.some((d) => d > 0);
    const hasNoResources = hasDemand && !(resourcesByRole.get(k)?.length);
    return { role, cells, hasNoResources, totalDeficit };
  });

  // ---- Collapse per-week shortfall into contiguous gap periods ----
  const gaps: GapPeriod[] = [];
  for (const [key, arr] of shortfall) {
    const [roleNorm, projectId] = key.split("|");
    const p = projectById.get(projectId);
    const roleLabel = requirements.find((r) => r.projectId === projectId && norm(r.role) === roleNorm)?.role ?? roleNorm;
    const noResourcesOfRole = !(resourcesByRole.get(roleNorm)?.length);

    let i = 0;
    while (i < arr.length) {
      if (arr[i] <= 0.001) {
        i++;
        continue;
      }
      let j = i;
      let peak = 0;
      while (j < arr.length && arr[j] > 0.001) {
        peak = Math.max(peak, arr[j]);
        j++;
      }
      gaps.push({
        role: roleLabel,
        projectId,
        projectName: p?.name ?? projectId,
        startWeek: weeks[i],
        endWeek: weeks[j - 1],
        weeks: j - i,
        shortfallFte: Math.round(peak * 100) / 100,
        noResourcesOfRole,
      });
      i = j;
    }
  }
  gaps.sort((a, b) => b.shortfallFte - a.shortfallFte || a.projectName.localeCompare(b.projectName));

  return { weeks, roles, roleRows, resourceRows, gaps };
}

// Richer summary for the AI recommendation endpoint. Still bounded (one entry
// per resource / gap, no week-by-week dump) but detailed enough for the model to
// reason about WHERE specific people should go, not just role-level totals.
export function buildRecommendationPayload(
  forecast: Forecast,
  resources: Resource[],
  projects: Project[]
) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const firstWeek = (pred: (i: number) => boolean) => {
    for (let i = 0; i < forecast.weeks.length; i++) if (pred(i)) return forecast.weeks[i];
    return null;
  };

  // Proposed moves the deterministic engine already worked out, per resource.
  const proposedMoves: {
    resource: string;
    role: string;
    project: string;
    startsWeek: string | null;
    weeks: number;
  }[] = [];
  // Bench: resources with free capacity the engine did NOT assign anywhere.
  const bench: {
    resource: string;
    role: string;
    freeFromWeek: string | null;
    spareFte: number;
  }[] = [];

  for (const row of forecast.resourceRows) {
    // Dominant proposed project across the horizon
    const proposedWeeks = row.cells.filter((c) => c.proposedProjectId);
    if (proposedWeeks.length) {
      // group by project, pick the one with most weeks
      const counts = new Map<string, number>();
      row.cells.forEach((c) => {
        if (c.proposedProjectId)
          counts.set(c.proposedProjectId, (counts.get(c.proposedProjectId) ?? 0) + 1);
      });
      const [topProject, wk] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      proposedMoves.push({
        resource: row.name,
        role: row.role,
        project: nameById.get(topProject) ?? topProject,
        startsWeek: firstWeek((i) => row.cells[i].proposedProjectId === topProject),
        weeks: wk,
      });
    }

    // Unassigned spare capacity (free but not proposed)
    const spareHours = row.cells.reduce(
      (s, c) => s + Math.max(0, c.freeHours) * (c.proposedFte > 0 ? 0 : 1),
      0
    );
    const spareFte = Math.round((spareHours / STANDARD_WEEK_HOURS / Math.max(forecast.weeks.length, 1)) * 100) / 100;
    if (spareFte > 0.1) {
      bench.push({
        resource: row.name,
        role: row.role,
        freeFromWeek: firstWeek((i) => row.cells[i].freeHours > 0 && row.cells[i].proposedFte === 0),
        spareFte,
      });
    }
  }

  return {
    horizonWeeks: forecast.weeks.length,
    from: forecast.weeks[0],
    to: forecast.weeks[forecast.weeks.length - 1],
    rolesWithNoResources: forecast.roleRows.filter((r) => r.hasNoResources).map((r) => r.role),
    gaps: forecast.gaps.map((g) => ({
      project: g.projectName,
      role: g.role,
      shortfallFte: g.shortfallFte,
      fromWeek: g.startWeek,
      toWeek: g.endWeek,
      weeks: g.weeks,
      noResourcesOfRole: g.noResourcesOfRole,
    })),
    proposedMoves,
    bench,
  };
}
