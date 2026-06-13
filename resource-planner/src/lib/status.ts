import type { ProjectStatus } from "@/types";

export function statusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200";
    case "Planning":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200";
    case "On Hold":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200";
    case "Completed":
      return "bg-muted text-muted-foreground hover:bg-muted";
  }
}

/** Distinct sorted tags across a set of projects. */
export function collectTags(projects: { tags?: string[] }[]): string[] {
  const all = new Set<string>();
  for (const p of projects) for (const t of p.tags ?? []) all.add(t);
  return [...all].sort();
}
