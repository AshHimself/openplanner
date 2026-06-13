import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export async function GET() {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { email, name, password, role } = await req.json();
  const passwordHash = await bcrypt.hash(password, 12);

  const [row] = await db
    .insert(users)
    .values({ email, name, passwordHash, role })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt });

  return NextResponse.json(row, { status: 201 });
}
