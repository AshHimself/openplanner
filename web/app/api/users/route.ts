import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/api-utils";

export async function GET() {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res!;

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users);

  return NextResponse.json(rows);
}
