"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { ROLES, PERMISSIONS, type Role, type PermissionKey } from "@/lib/permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Matrix = Record<string, Record<string, boolean>>;

export function AdminPermissions() {
  const { data, isLoading, mutate } = useSWR<Matrix>("/api/admin/permissions", fetcher);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(role: Role, permission: PermissionKey, enabled: boolean) {
    setSaving(`${role}|${permission}`);
    setError(null);
    // optimistic
    await mutate(
      (cur) => (cur ? { ...cur, [role]: { ...cur[role], [permission]: enabled } } : cur),
      { revalidate: false }
    );
    const res = await fetch("/api/admin/permissions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, permission, enabled }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      await mutate(); // revert from server
    }
    setSaving(null);
  }

  // group permissions
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tick which permissions each role has. Changes apply immediately and are enforced on the
        server.
      </p>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading matrix…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-medium capitalize">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((group) => (
                <PermGroup
                  key={group}
                  group={group}
                  matrix={data}
                  saving={saving}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PermGroup({
  group,
  matrix,
  saving,
  onToggle,
}: {
  group: string;
  matrix: Matrix;
  saving: string | null;
  onToggle: (role: Role, p: PermissionKey, enabled: boolean) => void;
}) {
  const perms = PERMISSIONS.filter((p) => p.group === group);
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={ROLES.length + 1} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {group}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.key} className="hover:bg-muted/20">
          <td className="px-3 py-2">
            <div className="font-medium">{p.label}</div>
            <div className="text-xs text-muted-foreground">{p.description}</div>
          </td>
          {ROLES.map((role) => {
            const checked = matrix[role]?.[p.key] ?? false;
            const busy = saving === `${role}|${p.key}`;
            return (
              <td key={role} className="px-3 py-2 text-center">
                {busy ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(role, p.key, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
