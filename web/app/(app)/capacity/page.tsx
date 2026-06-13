"use client";

import { Fragment, useMemo, useState } from "react";
import { mutate } from "swr";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  usePlanner,
  type Allocation,
  getWeeks,
  formatWeek,
  hoursInWeek,
  startOfWeek,
  addWeeks,
  toISO,
} from "@/lib/planner";

type Horizon = 12 | 26 | 52;
const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 12, label: "12 wks" },
  { value: 26, label: "6 mo" },
  { value: 52, label: "1 yr" },
];
const COL_MIN_W: Record<Horizon, number> = { 12: 64, 26: 44, 52: 32 };

function cellStyle(hours: number, capacity: number): string {
  if (hours === 0) return "bg-transparent text-muted-foreground/40";
  const ratio = hours / capacity;
  if (ratio > 1) return "bg-red-100 text-red-900 font-semibold";
  if (ratio >= 0.85) return "bg-emerald-100 text-emerald-900";
  if (ratio >= 0.5) return "bg-teal-50 text-teal-900";
  return "bg-muted text-muted-foreground";
}

const ALLOC_BLANK = {
  resourceId: "",
  projectId: "",
  hoursPerWeek: 20,
  startDate: toISO(startOfWeek(new Date())),
  endDate: toISO(addWeeks(startOfWeek(new Date()), 8)),
};

export default function CapacityPage() {
  const { resources, projects, allocations, isLoading } = usePlanner();
  const [horizon, setHorizon] = useState<Horizon>(12);
  const weeks = useMemo(() => getWeeks(horizon), [horizon]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Allocation sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState<Allocation | null>(null);
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>();
  const [form, setForm] = useState(ALLOC_BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openNew(resourceId?: string) {
    setEditingAlloc(null);
    setDefaultResourceId(resourceId);
    const monday = startOfWeek(new Date());
    setForm({
      ...ALLOC_BLANK,
      resourceId: resourceId ?? "",
      startDate: toISO(monday),
      endDate: toISO(addWeeks(monday, 8)),
    });
    setSheetOpen(true);
  }

  function openEdit(a: Allocation) {
    setEditingAlloc(a);
    setDefaultResourceId(undefined);
    setForm({
      resourceId: a.resourceId,
      projectId: a.projectId,
      hoursPerWeek: a.hoursPerWeek,
      startDate: a.startDate,
      endDate: a.endDate,
    });
    setSheetOpen(true);
  }

  async function save() {
    setSaving(true);
    if (editingAlloc) {
      await fetch(`/api/allocations/${editingAlloc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: crypto.randomUUID() }),
      });
    }
    await mutate("/api/allocations");
    setSheetOpen(false);
    setSaving(false);
  }

  async function del() {
    if (!editingAlloc) return;
    setDeleting(true);
    await fetch(`/api/allocations/${editingAlloc.id}`, { method: "DELETE" });
    await mutate("/api/allocations");
    setSheetOpen(false);
    setDeleting(false);
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Capacity plan</h2>
          <p className="text-sm text-muted-foreground">
            Weekly allocated hours vs. capacity, next {horizon} weeks. Click a row to expand;
            click a project cell to edit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border p-0.5">
            {HORIZONS.map((h) => (
              <button
                key={h.value}
                onClick={() => setHorizon(h.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  horizon === h.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="mr-1.5 h-4 w-4" />
            Allocation
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-muted ring-1 ring-border" /> Under 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-teal-50 ring-1 ring-teal-200" /> 50–85%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" /> 85–100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-100 ring-1 ring-red-200" /> Over capacity
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="sticky left-0 z-10 min-w-[220px] bg-muted/50 px-3 py-2 font-medium">
                Resource
              </th>
              {weeks.map((w) => (
                <th
                  key={w.getTime()}
                  className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                  style={{ minWidth: COL_MIN_W[horizon] }}
                >
                  {formatWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => {
              const resAllocs = allocations.filter((a) => a.resourceId === r.id);
              const totals = weeks.map((w) =>
                resAllocs.reduce((sum, a) => sum + hoursInWeek(a, w), 0)
              );
              const isOpen = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                    onClick={() => toggle(r.id)}
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.role} · {r.capacity}h/wk
                          </div>
                        </div>
                      </div>
                    </td>
                    {totals.map((h, i) => (
                      <td key={i} className="border-l px-1 py-1 text-center">
                        <div
                          className={`mx-auto rounded-sm px-1 py-1 tabular-nums text-xs ${cellStyle(h, r.capacity)}`}
                          title={`${h}h of ${r.capacity}h`}
                        >
                          {h > 0 ? h : "·"}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {isOpen && (
                    <>
                      {resAllocs.map((a) => {
                        const proj = projectById.get(a.projectId);
                        if (!proj) return null;
                        return (
                          <tr
                            key={a.id}
                            className="cursor-pointer border-b bg-muted/30 text-xs hover:bg-muted/60"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(a);
                            }}
                          >
                            <td className="sticky left-0 z-10 bg-muted/40 py-1.5 pl-10 pr-3">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                                  style={{ backgroundColor: proj.color }}
                                />
                                {proj.name}
                              </span>
                            </td>
                            {weeks.map((w, i) => {
                              const h = hoursInWeek(a, w);
                              return (
                                <td
                                  key={i}
                                  className="border-l px-1 py-1 text-center tabular-nums"
                                >
                                  {h > 0 ? (
                                    <span
                                      className="inline-block w-full rounded-sm py-0.5 text-[11px] text-white"
                                      style={{ backgroundColor: proj.color }}
                                    >
                                      {h}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/40">·</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="border-b bg-muted/20">
                        <td className="sticky left-0 z-10 bg-muted/30 py-1 pl-10 pr-3">
                          <button
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNew(r.id);
                            }}
                          >
                            + Allocate {r.name.split(" ")[0]} to a project
                          </button>
                        </td>
                        <td colSpan={horizon} />
                      </tr>
                    </>
                  )}
                </Fragment>
              );
            })}

            {resources.length === 0 && (
              <tr>
                <td
                  colSpan={horizon + 1}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No resources yet. Add one in the Resources view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Allocation Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingAlloc ? "Edit allocation" : "New allocation"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Resource</Label>
              <select
                value={form.resourceId}
                onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select resource…</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Hours per week</Label>
              <Input
                type="number"
                min={1}
                max={80}
                value={form.hoursPerWeek}
                onChange={(e) => setForm({ ...form, hoursPerWeek: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Budget impact preview */}
            {form.resourceId && form.projectId && (() => {
              const res = resources.find((r) => r.id === form.resourceId);
              const proj = projects.find((p) => p.id === form.projectId);
              if (!res?.dayRate) return null;
              const start = new Date(form.startDate);
              const end = new Date(form.endDate);
              const wks = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
              const cost = wks * (form.hoursPerWeek / 8) * res.dayRate;
              return (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost of this allocation</span>
                    <span className="font-medium tabular-nums">
                      ${cost.toLocaleString()} ({wks} wks)
                    </span>
                  </div>
                  {proj?.budget && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">{proj.code} budget</span>
                      <span className="tabular-nums">${proj.budget.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-between gap-2 pt-2">
              {editingAlloc ? (
                <Button variant="destructive" size="sm" onClick={del} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              ) : (
                <span />
              )}
              <Button
                onClick={save}
                disabled={saving || !form.resourceId || !form.projectId}
              >
                {saving ? "Saving…" : editingAlloc ? "Save changes" : "Add allocation"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
