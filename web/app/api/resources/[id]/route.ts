import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, resources } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { id } = await params;
  const body = await req.json();
  const [row] = await db
    .update(resources)
    .set(body)
    .where(eq(resources.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { id } = await params;
  await db.delete(resources).where(eq(resources.id, id));
  return new NextResponse(null, { status: 204 });
}
