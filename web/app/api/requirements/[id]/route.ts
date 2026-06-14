import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectRequirements } from "@/lib/db/schema";
import { requirePermission } from "@/lib/api-utils";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("requirements.edit");
  if (!ok) return res!;

  const { id } = await params;
  const body = await req.json();
  const patch = { ...body };
  if (patch.fte != null) patch.fte = String(patch.fte);

  const [row] = await db
    .update(projectRequirements)
    .set(patch)
    .where(eq(projectRequirements.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requirePermission("requirements.edit");
  if (!ok) return res!;

  const { id } = await params;
  await db.delete(projectRequirements).where(eq(projectRequirements.id, id));
  return new NextResponse(null, { status: 204 });
}
