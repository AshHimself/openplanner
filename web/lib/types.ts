// App-level types (what UI components use)
// Numeric DB fields (Postgres numeric → string) are normalised to JS number in hooks.ts

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";

export interface Project {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  priority: 1 | 2 | 3;
  color: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  manager?: string | null;
  budget?: number | null;
  tags?: string[] | null;
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  team: string;
  capacity: number; // hours per week
  dayRate?: number | null;
  avatarUrl?: string | null;
  tags?: string[] | null;
}

export interface Allocation {
  id: string;
  projectId: string;
  resourceId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}
