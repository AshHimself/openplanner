import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectRequirements } from "@/lib/db/schema";
import { requireRole, requirePermission } from "@/lib/api-utils";
import { randomUUID } from "crypto";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(projectRequirements);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requirePermission("requirements.edit");
  if (!ok) return res!;

  const body = await req.json();
  const id = randomUUID();

  const [row] = await db
    .insert(projectRequirements)
    .values({ ...body, id, fte: String(body.fte) })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
