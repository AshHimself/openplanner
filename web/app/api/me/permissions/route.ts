import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEffectivePermissions } from "@/lib/api-utils";
import type { Role } from "@/lib/permissions";

// Effective permissions for the currently signed-in user (drives client gating).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = ((session.user as { role?: string }).role ?? "viewer") as Role;
  const effective = await getEffectivePermissions(role);
  return NextResponse.json({ role, permissions: [...effective] });
}
