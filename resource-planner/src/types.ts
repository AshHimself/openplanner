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
  manager: string;
  /** Total approved budget in dollars; 0/undefined = no budget set. */
  budget?: number;
  /** Free-form labels used for filtering. */
  tags?: string[];
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  team: string;
  capacity: number; // hours per week
  /** Billing/cost rate per 8-hour day in dollars. */
  dayRate?: number;
}

export interface Allocation {
  id: string;
  resourceId: string;
  projectId: string;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
}

export interface PlannerState {
  projects: Project[];
  resources: Resource[];
  allocations: Allocation[];
}
