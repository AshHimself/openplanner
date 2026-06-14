import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timesheetEntries, resources } from "@/lib/db/schema";
import { requireRole } from "@/lib/api-utils";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(timesheetEntries).orderBy(timesheetEntries.weekOf);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { ok, res, session } = await requireRole("viewer");
  if (!ok) return res!;

  const body = await req.json();
  const id = randomUUID();
  const role = ((session!.user as { role?: string }).role ?? "viewer");

  // Viewers can only log for themselves — enforce by matching session name to resource
  if (role === "viewer" && body.resourceId) {
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, body.resourceId))
      .limit(1);
    const sessionName = (session!.user as { name?: string }).name ?? "";
    if (resource && resource.name.toLowerCase() !== sessionName.toLowerCase()) {
      return NextResponse.json({ error: "Viewers can only log their own time" }, { status: 403 });
    }
  }

  const [row] = await db
    .insert(timesheetEntries)
    .values({ ...body, id, hoursLogged: String(body.hoursLogged) })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
