import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";

export async function GET() {
  const { ok, res } = await requirePermission("users.manage");
  if (!ok) return res!;

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users);
  return NextResponse.json(rows);
}
