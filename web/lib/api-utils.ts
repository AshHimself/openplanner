import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rolePermissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  type Role,
  type PermissionKey,
  ALL_PERMISSION_KEYS,
  defaultHasPermission,
} from "@/lib/permissions";

const LEVEL: Record<Role, number> = { viewer: 1, planner: 2, admin: 3 };

export async function requireRole(minRole: Role) {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  const role = ((session.user as { role?: string }).role ?? "viewer") as Role;
  if (LEVEL[role] < LEVEL[minRole]) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { ok: true, res: null, session };
}

// Resolve a role's effective permissions: DB overrides merged over code defaults.
export async function getEffectivePermissions(role: Role): Promise<Set<PermissionKey>> {
  const rows = await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role));
  const overrides = new Map(rows.map((r) => [r.permission, r.enabled]));
  const effective = new Set<PermissionKey>();
  for (const key of ALL_PERMISSION_KEYS) {
    const enabled = overrides.has(key) ? overrides.get(key)! : defaultHasPermission(role, key);
    if (enabled) effective.add(key);
  }
  return effective;
}

// Gate an API route by a single permission.
export async function requirePermission(permission: PermissionKey) {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  const role = ((session.user as { role?: string }).role ?? "viewer") as Role;
  const effective = await getEffectivePermissions(role);
  if (!effective.has(permission)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { ok: true, res: null, session };
}
