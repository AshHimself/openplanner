import { NextRequest, NextResponse } from "next/server";
import { db, resources } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res;

  const rows = await db.select().from(resources);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requireRole("admin");
  if (!ok) return res;

  const body = await req.json();
  const [row] = await db.insert(resources).values(body).returning();
  return NextResponse.json(row, { status: 201 });
}
