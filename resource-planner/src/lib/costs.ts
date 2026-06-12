import type { Allocation, Resource } from "@/types";
import { parseISO, startOfWeek } from "@/lib/dates";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOURS_PER_DAY = 8;

/** Number of week columns an allocation spans (inclusive of partial weeks). */
export function allocationWeeks(a: Allocation): number {
  const start = startOfWeek(parseISO(a.startDate)).getTime();
  const end = startOfWeek(parseISO(a.endDate)).getTime();
  if (end < start) return 0;
  return Math.round((end - start) / WEEK_MS) + 1;
}

/** Forecast cost of one allocation over its full span, at the resource's day rate. */
export function allocationCost(a: Allocation, resource: Resource | undefined): number {
  const rate = resource?.dayRate ?? 0;
  return allocationWeeks(a) * (a.hoursPerWeek / HOURS_PER_DAY) * rate;
}

/** Total forecast cost of all allocations on a project. */
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
