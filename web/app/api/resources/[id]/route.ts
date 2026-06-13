import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema";
import { requireRole } from "@/lib/api-utils";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res!;

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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res!;

  const { id } = await params;
  await db.delete(resources).where(eq(resources.id, id));
  return new NextResponse(null, { status: 204 });
}
