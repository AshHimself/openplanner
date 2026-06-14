import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timesheetEntries, projects, resources } from "@/lib/db/schema";
import { requireRole } from "@/lib/api-utils";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// Excel date serial → JS Date
function excelDateToISO(serial: number): string {
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utc);
  // Snap to Monday of that week
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function toMonday(input: string): string {
  const parts = input.trim().split(/[-/]/);
  let d: Date;
  if (parts.length === 3 && parts[0].length === 4) {
    d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  } else {
    d = new Date(input);
    if (isNaN(d.getTime())) return input;
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const { ok, res } = await requireRole("planner");
  if (!ok) return res!;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Dynamic import keeps xlsx out of the main bundle
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (raw.length === 0) return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });

  // Load projects and resources for lookup
  const allProjects = await db.select().from(projects);
  const allResources = await db.select().from(resources);

  const projectByCode = new Map(allProjects.map((p) => [p.code.toLowerCase(), p.id]));
  const projectById = new Map(allProjects.map((p) => [p.id.toLowerCase(), p.id]));
  const resourceByName = new Map(allResources.map((r) => [r.name.toLowerCase(), r.id]));
  const resourceById = new Map(allResources.map((r) => [r.id.toLowerCase(), r.id]));

  type ParsedRow = { projectId: string; resourceId: string | null; weekOf: string; hoursLogged: number; notes: string };
  const parsed: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Resolve week
    const weekRaw = row["Week"] ?? row["Date"] ?? row["week"] ?? row["date"] ?? "";
    let weekOf: string;
    if (typeof weekRaw === "number") {
      weekOf = excelDateToISO(weekRaw);
    } else if (typeof weekRaw === "string" && weekRaw) {
      weekOf = toMonday(weekRaw);
    } else {
      errors.push(`Row ${rowNum}: missing Week/Date`);
      continue;
    }

    // Resolve project
    const projRaw = String(row["Project"] ?? row["ProjectID"] ?? row["project_id"] ?? row["Project Code"] ?? "").trim();
    const projectId =
      projectByCode.get(projRaw.toLowerCase()) ??
      projectById.get(projRaw.toLowerCase()) ??
      null;
    if (!projectId) {
      errors.push(`Row ${rowNum}: project "${projRaw}" not found`);
      continue;
    }

    // Resolve resource (optional)
    const resRaw = String(row["Resource"] ?? row["ResourceID"] ?? row["resource_id"] ?? row["Resource Name"] ?? "").trim();
    let resourceId: string | null = null;
    if (resRaw) {
      resourceId =
        resourceByName.get(resRaw.toLowerCase()) ??
        resourceById.get(resRaw.toLowerCase()) ??
        null;
      if (!resourceId) {
        errors.push(`Row ${rowNum}: resource "${resRaw}" not found — row skipped`);
        continue;
      }
    }

    // Hours
    const hoursRaw = row["Hours"] ?? row["hours"] ?? row["Hours Logged"] ?? "";
    const hoursLogged = Number(hoursRaw);
    if (isNaN(hoursLogged) || hoursLogged < 0) {
      errors.push(`Row ${rowNum}: invalid hours "${hoursRaw}"`);
      continue;
    }

    const notes = String(row["Notes"] ?? row["notes"] ?? "").trim() || null;
    parsed.push({ projectId, resourceId: resourceId ?? null, weekOf, hoursLogged, notes: notes ?? "" });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid rows", details: errors }, { status: 422 });
  }

  // Delete existing entries for the (projectId, weekOf) combinations in this upload
  const keys = [...new Set(parsed.map((r) => `${r.projectId}|${r.weekOf}`))];
  for (const key of keys) {
    const [pid, wof] = key.split("|");
    await db
      .delete(timesheetEntries)
      .where(and(eq(timesheetEntries.projectId, pid), eq(timesheetEntries.weekOf, wof)));
  }

  // Insert fresh rows (skip zero-hour rows)
  const toInsert = parsed
    .filter((r) => r.hoursLogged > 0)
    .map((r) => ({ id: randomUUID(), ...r, hoursLogged: String(r.hoursLogged) }));

  if (toInsert.length > 0) {
    await db.insert(timesheetEntries).values(toInsert);
  }

  return NextResponse.json({
    inserted: toInsert.length,
    skippedZero: parsed.filter((r) => r.hoursLogged === 0).length,
    errors,
  });
}
