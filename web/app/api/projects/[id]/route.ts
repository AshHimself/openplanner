import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, projects } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res;

  const { id } = await params;
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res;

  const { id } = await params;
  const body = await req.json();
  const [row] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const { id } = await params;
  await db.delete(projects).where(eq(projects.id, id));
  return new NextResponse(null, { status: 204 });
}
