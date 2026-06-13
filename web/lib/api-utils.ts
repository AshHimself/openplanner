import { NextResponse } from "next/server";
import { auth } from "@/auth";

type Role = "admin" | "planner" | "viewer";
const LEVEL: Record<Role, number> = { viewer: 1, planner: 2, admin: 3 };

export async function requireRole(minRole: Role) {
  const session = await auth();
  if (!session) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  const role = (session.user.role ?? "viewer") as Role;
  if (LEVEL[role] < LEVEL[minRole]) {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { ok: true as const, res: null, session };
}
