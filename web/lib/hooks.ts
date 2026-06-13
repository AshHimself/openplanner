"use client";

import useSWR, { mutate } from "swr";
import type { Project, Resource, Allocation } from "@/lib/types";

// Postgres `numeric` columns come back as strings — normalise on the way in.
function normaliseProject(r: Record<string, unknown>): Project {
  return {
    ...(r as unknown as Project),
    priority: Number(r.priority) as 1 | 2 | 3,
    budget: r.budget != null ? Number(r.budget) : null,
  };
}
function normaliseResource(r: Record<string, unknown>): Resource {
  return {
    ...(r as unknown as Resource),
    capacity: Number(r.capacity),
    dayRate: r.dayRate != null ? Number(r.dayRate) : null,
  };
}
function normaliseAllocation(r: Record<string, unknown>): Allocation {
  return {
    ...(r as unknown as Allocation),
    hoursPerWeek: Number(r.hoursPerWeek),
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── projects ───────────────────────────────────────────────────────────────

export function useProjects() {
  const { data, error, isLoading } = useSWR<Record<string, unknown>[]>("/api/projects", fetcher);
  return { projects: (data ?? []).map(normaliseProject), error, isLoading };
}

export async function saveProject(project: Omit<Project, "id"> & { id?: string }) {
  const isNew = !project.id;
  const url = isNew ? "/api/projects" : `/api/projects/${project.id}`;
  await fetch(url, {
    method: isNew ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  mutate("/api/projects");
}

export async function deleteProject(id: string) {
  await fetch(`/api/projects/${id}`, { method: "DELETE" });
  mutate("/api/projects");
}

// ── resources ──────────────────────────────────────────────────────────────

export function useResources() {
  const { data, error, isLoading } = useSWR<Record<string, unknown>[]>("/api/resources", fetcher);
  return { resources: (data ?? []).map(normaliseResource), error, isLoading };
}

export async function saveResource(resource: Omit<Resource, "id"> & { id?: string }) {
  const isNew = !resource.id;
  const url = isNew ? "/api/resources" : `/api/resources/${resource.id}`;
  await fetch(url, {
    method: isNew ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resource),
  });
  mutate("/api/resources");
}

export async function deleteResource(id: string) {
  await fetch(`/api/resources/${id}`, { method: "DELETE" });
  mutate("/api/resources");
}

// ── allocations ────────────────────────────────────────────────────────────

export function useAllocations() {
  const { data, error, isLoading } = useSWR<Record<string, unknown>[]>("/api/allocations", fetcher);
  return { allocations: (data ?? []).map(normaliseAllocation), error, isLoading };
}

export async function saveAllocation(allocation: Omit<Allocation, "id"> & { id?: string }) {
  const isNew = !allocation.id;
  const url = isNew ? "/api/allocations" : `/api/allocations/${allocation.id}`;
  await fetch(url, {
    method: isNew ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(allocation),
  });
  mutate("/api/allocations");
}

export async function deleteAllocation(id: string) {
  await fetch(`/api/allocations/${id}`, { method: "DELETE" });
  mutate("/api/allocations");
}

// ── combined convenience hook (mirrors old usePlanner()) ───────────────────

export function usePlanner() {
  const { projects, isLoading: lp } = useProjects();
  const { resources, isLoading: lr } = useResources();
  const { allocations, isLoading: la } = useAllocations();
  return {
    projects,
    resources,
    allocations,
    isLoading: lp || lr || la,
    saveProject,
    deleteProject,
    saveResource,
    deleteResource,
    saveAllocation,
    deleteAllocation,
  };
}
