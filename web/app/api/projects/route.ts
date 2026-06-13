import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, projects } from "@/lib/db";
import { requireRole } from "@/lib/api-utils";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res;

  const rows = await db.select().from(projects).orderBy(projects.createdAt);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res;

  const body = await req.json();
  const [row] = await db.insert(projects).values(body).returning();
  return NextResponse.json(row, { status: 201 });
}
