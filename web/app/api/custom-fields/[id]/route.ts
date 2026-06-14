import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customFieldDefinitions } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("customfields.manage");
  if (!ok) return res!;

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.label != null) patch.label = String(body.label).trim();
  if (body.options != null) patch.options = (body.options as string[]).filter(Boolean);
  if (body.sortOrder != null) patch.sortOrder = Number(body.sortOrder);

  const [row] = await db
    .update(customFieldDefinitions)
    .set(patch)
    .where(eq(customFieldDefinitions.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("customfields.manage");
  if (!ok) return res!;

  const { id } = await params;
  await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));
  return new NextResponse(null, { status: 204 });
}
