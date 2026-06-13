import useSWR from "swr";

export interface Project {
  id: string;
  name: string;
  code: string;
  status: "Planning" | "Active" | "On Hold" | "Completed";
  priority: 1 | 2 | 3;
  color: string;
  startDate: string;
  endDate: string;
  manager?: string;
  budget?: number | null;
  tags?: string[];
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  team: string;
  capacity: number;
  dayRate?: number | null;
  avatarUrl?: string;
  tags?: string[];
}

export interface Allocation {
  id: string;
  projectId: string;
  resourceId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}

export function normaliseProject(r: Record<string, unknown>): Project {
  return {
    ...(r as unknown as Project),
    priority: Number(r.priority) as 1 | 2 | 3,
    budget: r.budget != null ? Number(r.budget) : null,
  };
}

export function normaliseResource(r: Record<string, unknown>): Resource {
  return {
    ...(r as unknown as Resource),
    capacity: Number(r.capacity),
    dayRate: r.dayRate != null ? Number(r.dayRate) : null,
  };
}

export function normaliseAllocation(r: Record<string, unknown>): Allocation {
  return { ...(r as unknown as Allocation), hoursPerWeek: Number(r.hoursPerWeek) };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePlanner() {
  const { data: projectsRaw, isLoading: pL } = useSWR<unknown[]>("/api/projects", fetcher);
  const { data: resourcesRaw, isLoading: rL } = useSWR<unknown[]>("/api/resources", fetcher);
  const { data: allocationsRaw, isLoading: aL } = useSWR<unknown[]>("/api/allocations", fetcher);

  return {
    projects: (projectsRaw ?? []).map((r) => normaliseProject(r as Record<string, unknown>)),
    resources: (resourcesRaw ?? []).map((r) => normaliseResource(r as Record<string, unknown>)),
    allocations: (allocationsRaw ?? []).map((r) =>
      normaliseAllocation(r as Record<string, unknown>)
    ),
    isLoading: pL || rL || aL,
  };
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(d: Date): Date {
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = b.getDay();
  b.setDate(b.getDate() + (dow === 0 ? -6 : 1 - dow));
  return b;
}

export function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoursInWeek(alloc: Allocation, week: Date): number {
  const weekEnd = new Date(week);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const start = parseLocalDate(alloc.startDate);
  const end = parseLocalDate(alloc.endDate);
  return start <= weekEnd && end >= week ? alloc.hoursPerWeek : 0;
}

export function getWeeks(count: number, from?: Date): Date[] {
  const monday = startOfWeek(from ?? new Date());
  return Array.from({ length: count }, (_, i) => addWeeks(monday, i));
}

export function formatWeek(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function allocationCost(alloc: Allocation, resource?: Resource | null): number {
  if (!resource?.dayRate) return 0;
  const start = parseLocalDate(alloc.startDate);
  const end = parseLocalDate(alloc.endDate);
  const weeks = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
  return weeks * (alloc.hoursPerWeek / 8) * resource.dayRate;
}

export function projectForecast(
  projectId: string,
  allocations: Allocation[],
  resources: Resource[]
): number {
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  return allocations
    .filter((a) => a.projectId === projectId)
    .reduce((sum, a) => sum + allocationCost(a, resourceMap.get(a.resourceId)), 0);
}

export const STATUS_COLORS: Record<string, string> = {
  Planning: "bg-blue-100 text-blue-700",
  Active: "bg-green-100 text-green-700",
  "On Hold": "bg-amber-100 text-amber-700",
  Completed: "bg-gray-100 text-gray-600",
};

export const PRIORITY_LABELS: Record<number, string> = { 1: "P1 — Critical", 2: "P2 — High", 3: "P3 — Normal" };

export const PROJECT_COLORS = [
  "#0e7490", "#9a3412", "#3f6212", "#86198f", "#1d4ed8",
  "#a16207", "#be123c", "#4338ca", "#0f766e", "#b45309",
];

export const STATUSES = ["Planning", "Active", "On Hold", "Completed"] as const;
