import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rolePermissions } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";
import { and, eq } from "drizzle-orm";
import {
  ROLES,
  ALL_PERMISSION_KEYS,
  defaultHasPermission,
  type Role,
  type PermissionKey,
} from "@/lib/permissions";

// Returns the full matrix: { role: { permission: enabled } }, defaults merged.
export async function GET() {
  const { ok, res } = await requirePermission("permissions.manage");
  if (!ok) return res!;

  const rows = await db.select().from(rolePermissions);
  const overrides = new Map(rows.map((r) => [`${r.role}|${r.permission}`, r.enabled]));

  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of ROLES) {
    matrix[role] = {};
    for (const key of ALL_PERMISSION_KEYS) {
      const k = `${role}|${key}`;
      matrix[role][key] = overrides.has(k) ? overrides.get(k)! : defaultHasPermission(role, key);
    }
  }
  return NextResponse.json(matrix);
}

// Upsert a single (role, permission) toggle.
export async function PUT(req: NextRequest) {
  const { ok, res } = await requirePermission("permissions.manage");
  if (!ok) return res!;

  const body = await req.json();
  const role = body.role as Role;
  const permission = body.permission as PermissionKey;
  const enabled = !!body.enabled;
  if (!ROLES.includes(role) || !ALL_PERMISSION_KEYS.includes(permission)) {
    return NextResponse.json({ error: "Invalid role or permission" }, { status: 400 });
  }
  // Guard: never let an admin remove their own admin access / permission control.
  if (role === "admin" && (permission === "admin.access" || permission === "permissions.manage") && !enabled) {
    return NextResponse.json(
      { error: "Admins must keep admin access and permission control." },
      { status: 400 }
    );
  }

  const existing = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.role, role), eq(rolePermissions.permission, permission)));

  if (existing.length) {
    await db
      .update(rolePermissions)
      .set({ enabled })
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.permission, permission)));
  } else {
    await db.insert(rolePermissions).values({ role, permission, enabled });
  }

  return NextResponse.json({ role, permission, enabled });
}
