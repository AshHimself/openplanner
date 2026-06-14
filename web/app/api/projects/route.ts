import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireRole, requirePermission } from "@/lib/api-utils";
import { randomUUID } from "crypto";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(projects);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requirePermission("projects.edit");
  if (!ok) return res!;

  const body = await req.json();
  const id = body.id ?? randomUUID();

  const [row] = await db
    .insert(projects)
    .values({ ...body, id })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
