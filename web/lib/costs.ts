import type { Allocation, Resource } from "@/lib/types";
import { parseISO, startOfWeek } from "@/lib/dates";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOURS_PER_DAY = 8;

export function allocationWeeks(a: Allocation): number {
  const start = startOfWeek(parseISO(a.startDate)).getTime();
  const end = startOfWeek(parseISO(a.endDate)).getTime();
  if (end < start) return 0;
  return Math.round((end - start) / WEEK_MS) + 1;
}

export function allocationCost(a: Allocation, resource: Resource | undefined): number {
  const rate = resource?.dayRate ?? 0;
  return allocationWeeks(a) * (a.hoursPerWeek / HOURS_PER_DAY) * rate;
}

export function projectForecast(
  projectId: string,
  allocations: Allocation[],
  resources: Resource[]
): number {
  const byId = new Map(resources.map((r) => [r.id, r]));
  return allocations
    .filter((a) => a.projectId === projectId)
    .reduce((sum, a) => sum + allocationCost(a, byId.get(a.resourceId)), 0);
}

export function fmtCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
