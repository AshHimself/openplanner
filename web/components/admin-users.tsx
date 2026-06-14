"use client";

import useSWR from "swr";
import { ROLES, type Role } from "@/lib/permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-violet-100 text-violet-700",
  planner: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

export function AdminUsers() {
  const { data, isLoading, mutate } = useSWR<AdminUser[]>("/api/admin/users", fetcher);
  const users = data ?? [];

  async function setRole(id: string, role: Role) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Could not change role.");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Assign each user a role. What each role can do is configured in the Permissions tab.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-right font-medium">Change role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">{u.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value as Role)}
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
