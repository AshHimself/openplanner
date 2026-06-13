import { NextResponse } from "next/server";
import { auth } from "@/auth";

type Role = "viewer" | "planner" | "admin";

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
