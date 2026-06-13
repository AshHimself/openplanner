import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema";
import { requireRole } from "@/lib/api-utils";
import { randomUUID } from "crypto";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(resources);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res!;

  const body = await req.json();
  const id = body.id ?? randomUUID();

  const [row] = await db
    .insert(resources)
    .values({ ...body, id })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
