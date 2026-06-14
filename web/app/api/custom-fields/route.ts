import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customFieldDefinitions } from "@/lib/db/schema";
import { requireRole, requirePermission } from "@/lib/api-utils";
import { randomUUID } from "crypto";

// Anyone signed in can READ definitions (entity forms need them to render).
export async function GET() {
  const { ok, res } = await requireRole("viewer");
  if (!ok) return res!;

  const rows = await db.select().from(customFieldDefinitions).orderBy(customFieldDefinitions.sortOrder);
  return NextResponse.json(rows);
}

// Only those with the manage permission can create definitions.
export async function POST(req: NextRequest) {
  const { ok, res } = await requirePermission("customfields.manage");
  if (!ok) return res!;

  const body = await req.json();
  const entity = body.entity === "project" ? "project" : "resource";
  const type = ["text", "number", "date", "select"].includes(body.type) ? body.type : "text";
  const label = String(body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  // Derive a stable slug key from the label.
  const baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  const existing = await db.select().from(customFieldDefinitions);
  let key = baseKey;
  let n = 1;
  while (existing.some((d) => d.entity === entity && d.key === key)) key = `${baseKey}_${++n}`;

  const [row] = await db
    .insert(customFieldDefinitions)
    .values({
      id: randomUUID(),
      entity,
      key,
      label,
      type,
      options: type === "select" ? (body.options ?? []).filter(Boolean) : [],
      sortOrder: Number(body.sortOrder ?? existing.length),
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
