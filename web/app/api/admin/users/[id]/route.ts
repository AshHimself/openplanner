import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";
import { eq } from "drizzle-orm";
import { ROLES, type Role } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res, session } = await requirePermission("users.manage");
  if (!ok) return res!;

  const { id } = await params;
  const body = await req.json();
  const role = body.role as Role;
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Don't let an admin demote themselves (avoids locking out the last admin).
  if (session!.user?.email) {
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (target?.email === session!.user.email && role !== "admin") {
      return NextResponse.json({ error: "You can't change your own admin role." }, { status: 400 });
    }
  }

  const [row] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}
