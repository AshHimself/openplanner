import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Allocation, PlannerState, Project, Resource } from "@/types";
import { buildSeedState } from "@/data/seed";

const STORAGE_KEY = "open-planner-v1";

function loadInitial(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PlannerState;
  } catch {
    // storage unavailable (sandboxed) — fall through to seed
  }
  return buildSeedState();
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

interface PlannerStore extends PlannerState {
  saveProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  saveResource: (r: Resource) => void;
  deleteResource: (id: string) => void;
  saveAllocation: (a: Allocation) => void;
  deleteAllocation: (id: string) => void;
  resetToSeed: () => void;
}

const PlannerContext = createContext<PlannerStore | null>(null);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlannerState>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — in-memory only
    }
  }, [state]);

  const store = useMemo<PlannerStore>(
    () => ({
      ...state,
      saveProject: (p) => setState((s) => ({ ...s, projects: upsert(s.projects, p) })),
      deleteProject: (id) =>
        setState((s) => ({
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          allocations: s.allocations.filter((a) => a.projectId !== id),
        })),
      saveResource: (r) => setState((s) => ({ ...s, resources: upsert(s.resources, r) })),
      deleteResource: (id) =>
        setState((s) => ({
          ...s,
          resources: s.resources.filter((r) => r.id !== id),
          allocations: s.allocations.filter((a) => a.resourceId !== id),
        })),
      saveAllocation: (a) => setState((s) => ({ ...s, allocations: upsert(s.allocations, a) })),
      deleteAllocation: (id) =>
        setState((s) => ({ ...s, allocations: s.allocations.filter((a) => a.id !== id) })),
      resetToSeed: () => setState(buildSeedState()),
    }),
    [state]
  );

  return <PlannerContext.Provider value={store}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerStore {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}
