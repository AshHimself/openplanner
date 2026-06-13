import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { id } = await params;
  const { name, role, password } = await req.json();

  const update: Record<string, unknown> = { name, role };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);

  const [row] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { id } = await params;
  await db.delete(users).where(eq(users.id, id));
  return new NextResponse(null, { status: 204 });
}
