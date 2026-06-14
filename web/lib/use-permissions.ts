"use client";

import useSWR from "swr";
import type { PermissionKey, Role } from "@/lib/permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MePermissions {
  role: Role;
  permissions: PermissionKey[];
}

// Effective permissions for the signed-in user, used to gate UI. Server routes
// enforce the same permissions independently — this is UX only.
export function usePermissions() {
  const { data, isLoading } = useSWR<MePermissions>("/api/me/permissions", fetcher);
  const set = new Set(data?.permissions ?? []);
  return {
    role: data?.role,
    isLoading,
    can: (p: PermissionKey) => set.has(p),
  };
}
