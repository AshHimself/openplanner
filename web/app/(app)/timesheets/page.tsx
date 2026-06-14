"use client";

import { useRef, useState, useMemo } from "react";
import { mutate } from "swr";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogTimeSheet } from "@/components/log-time-sheet";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePlanner,
  useTimesheets,
  projectActualHours,
  projectActualCost,
  formatCurrency,
  formatWeek,
  startOfWeek,
  addWeeks,
  toISO,
  parseLocalDate,
} from "@/lib/planner";

const HORIZON = 12; // weeks visible at once

export default function TimesheetsPage() {
  const { projects, resources, isLoading: plannerLoading } = usePlanner();
  const { timesheets, isLoading: tsLoading, mutate: mutatets } = useTimesheets();
  const isLoading = plannerLoading || tsLoading;

  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    inserted?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const weeks = useMemo(() => {
    const base = startOfWeek(new Date());
    // Start from a few weeks back to show recent actuals
    const from = addWeeks(base, weekOffset - 4);
    return Array.from({ length: HORIZON }, (_, i) => addWeeks(from, i));
  }, [weekOffset]);

  // Projects with any actuals
  const activeProjects = useMemo(
    () => projects.filter((p) => projectActualHours(p.id, timesheets) > 0 || p.status === "Active"),
    [projects, timesheets]
  );

  // Over-budget projects (actuals cost > budget)
  const overBudgetProjects = useMemo(
    () =>
      projects.filter((p) => {
        if (!p.budget) return false;
        const actual = projectActualCost(p.id, timesheets, resources);
        return actual > 0 && actual > p.budget;
      }),
    [projects, timesheets, resources]
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/timesheets/upload", { method: "POST", body: fd });
      const json = await r.json();
      setUploadResult(json);
      if (r.ok) {
        await mutate("/api/timesheets");
      }
    } catch {
      setUploadResult({ error: "Upload failed — check network and try again." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/timesheets/${id}`, { method: "DELETE" });
    await mutate("/api/timesheets");
  }

  function downloadTemplate() {
    const rows = [
      ["Week", "Project", "Resource", "Hours", "Notes"],
      ["2026-06-02", "WEB-001", "Alice Smith", "32", ""],
      ["2026-06-02", "MOB-001", "Carol Davis", "40", "Sprint 12"],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timesheet_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Timesheets</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track actual hours logged against projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1.5 h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading…" : "Upload Excel / CSV"}
          </Button>
          <Button size="sm" onClick={() => setLogSheetOpen(true)}>
            <Clock className="mr-1.5 h-4 w-4" />
            Log Time
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div
          className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
            uploadResult.error || (uploadResult.errors?.length ?? 0) > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {uploadResult.error ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <div className="flex-1">
            {uploadResult.error ? (
              <p>{uploadResult.error}</p>
            ) : (
              <p>
                {uploadResult.inserted} {uploadResult.inserted === 1 ? "row" : "rows"} imported
                successfully.
              </p>
            )}
            {(uploadResult.errors?.length ?? 0) > 0 && (
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {uploadResult.errors!.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setUploadResult(null)}>
            <X className="h-4 w-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <strong>Excel / CSV format:</strong> Columns{" "}
        <code className="rounded bg-muted px-1">Week</code>,{" "}
        <code className="rounded bg-muted px-1">Project</code> (code or ID),{" "}
        <code className="rounded bg-muted px-1">Resource</code> (name or ID, optional),{" "}
        <code className="rounded bg-muted px-1">Hours</code>,{" "}
        <code className="rounded bg-muted px-1">Notes</code> (optional). Week is snapped to the
        nearest Monday. Download the template above for an example.
      </div>

      {/* Over-budget alert */}
      {overBudgetProjects.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            {overBudgetProjects.length}{" "}
            {overBudgetProjects.length === 1 ? "project" : "projects"} over budget based on actuals
          </div>
          <div className="flex flex-wrap gap-2">
            {overBudgetProjects.map((p) => {
              const actual = projectActualCost(p.id, timesheets, resources);
              const over = actual - (p.budget ?? 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm font-medium text-red-900">{p.name}</span>
                  <span className="text-xs text-red-600">
                    {formatCurrency(over)} over ({formatCurrency(actual)} spent /{" "}
                    {formatCurrency(p.budget ?? 0)} budget)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total hours logged"
            value={`${timesheets.reduce((s, t) => s + t.hoursLogged, 0).toLocaleString()}h`}
          />
          <StatCard label="Projects with actuals" value={String(overBudgetProjects.length > 0 ? activeProjects.length : activeProjects.length)} />
          <StatCard label="Over budget" value={String(overBudgetProjects.length)} tone={overBudgetProjects.length > 0 ? "bad" : "good"} />
          <StatCard
            label="Timesheet entries"
            value={timesheets.length.toLocaleString()}
          />
        </div>
      )}

      {/* Weekly grid */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Hours by project · week</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o - HORIZON)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center text-xs text-muted-foreground">
              {formatWeek(weeks[0])} — {formatWeek(weeks[weeks.length - 1])}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o + HORIZON)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-[180px] bg-background">Project</TableHead>
                {weeks.map((w) => (
                  <TableHead key={toISO(w)} className="min-w-[70px] text-right text-xs">
                    {formatWeek(w)}
                  </TableHead>
                ))}
                <TableHead className="min-w-[80px] text-right text-xs font-semibold">Total</TableHead>
                <TableHead className="min-w-[90px] text-right text-xs">Budget</TableHead>
                <TableHead className="min-w-[90px] text-right text-xs">Actual cost</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={weeks.length + 5} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : activeProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={weeks.length + 5} className="py-10 text-center text-sm text-muted-foreground">
                    No projects yet. Upload a timesheet to get started.
                  </TableCell>
                </TableRow>
              ) : (
                activeProjects.map((p) => {
                  const totalHours = projectActualHours(p.id, timesheets);
                  const actualCost = projectActualCost(p.id, timesheets, resources);
                  const isOver = p.budget ? actualCost > p.budget : false;

                  return (
                    <TableRow key={p.id} className={isOver ? "bg-red-50/50" : undefined}>
                      <TableCell className="sticky left-0 z-10 bg-inherit">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: p.color }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              {p.name}
                              {isOver && (
                                <Badge className="bg-red-100 px-1 py-0 text-[10px] text-red-700 hover:bg-red-100">
                                  over budget
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      {weeks.map((w) => {
                        const weekStr = toISO(w);
                        const hrs = timesheets
                          .filter((t) => t.projectId === p.id && t.weekOf === weekStr)
                          .reduce((s, t) => s + t.hoursLogged, 0);
                        return (
                          <TableCell
                            key={weekStr}
                            className={`text-right tabular-nums text-sm ${hrs > 0 ? "font-medium" : "text-muted-foreground"}`}
                          >
                            {hrs > 0 ? `${hrs}h` : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {totalHours > 0 ? `${totalHours}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {p.budget ? formatCurrency(p.budget) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-sm font-medium ${
                          isOver ? "text-red-600" : actualCost > 0 ? "text-emerald-700" : "text-muted-foreground"
                        }`}
                      >
                        {actualCost > 0 ? formatCurrency(actualCost) : "—"}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })
              )}
              {/* Totals row */}
              {!isLoading && activeProjects.length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell className="sticky left-0 z-10 bg-background text-sm">Total</TableCell>
                  {weeks.map((w) => {
                    const weekStr = toISO(w);
                    const hrs = timesheets
                      .filter((t) => t.weekOf === weekStr)
                      .reduce((s, t) => s + t.hoursLogged, 0);
                    return (
                      <TableCell key={weekStr} className={`text-right tabular-nums text-sm ${hrs > 0 ? "" : "text-muted-foreground"}`}>
                        {hrs > 0 ? `${hrs}h` : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums text-sm">
                    {timesheets.reduce((s, t) => s + t.hoursLogged, 0)}h
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Entry log */}
      {timesheets.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium">All entries</h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week of</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...timesheets]
                  .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
                  .slice(0, 100)
                  .map((t) => {
                    const proj = projects.find((p) => p.id === t.projectId);
                    const res = resources.find((r) => r.id === t.resourceId);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm tabular-nums">
                          {formatWeek(parseLocalDate(t.weekOf))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {proj && (
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                                style={{ backgroundColor: proj.color }}
                              />
                            )}
                            <span className="text-sm">{proj?.name ?? t.projectId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {res?.name ?? (t.resourceId ? t.resourceId : "—")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {t.hoursLogged}h
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {t.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-muted-foreground hover:text-red-600"
                            onClick={() => deleteEntry(t.id)}
                            title="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            {timesheets.length > 100 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                Showing latest 100 of {timesheets.length} entries
              </p>
            )}
          </div>
        </div>
      )}

      <LogTimeSheet open={logSheetOpen} onOpenChange={setLogSheetOpen} />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          tone === "bad" ? "text-red-600" : tone === "good" && value !== "0" ? "text-emerald-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
