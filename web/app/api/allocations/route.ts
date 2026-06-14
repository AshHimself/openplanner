import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocations } from "@/lib/db/schema";
import { requireRole, requirePermission } from "@/lib/api-utils";
import { randomUUID } from "crypto";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(allocations);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requirePermission("allocations.edit");
  if (!ok) return res!;

  const body = await req.json();
  const id = body.id ?? randomUUID();

  const [row] = await db
    .insert(allocations)
    .values({ ...body, id })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
