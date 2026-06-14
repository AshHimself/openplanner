import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocations } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("allocations.edit");
  if (!ok) return res!;

  const { id } = await params;
  const body = await req.json();

  const [row] = await db
    .update(allocations)
    .set(body)
    .where(eq(allocations.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("allocations.edit");
  if (!ok) return res!;

  const { id } = await params;
  await db.delete(allocations).where(eq(allocations.id, id));
  return new NextResponse(null, { status: 204 });
}
