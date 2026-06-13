"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  usePlanner,
  normaliseProject,
  type Project,
  type Allocation,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PROJECT_COLORS,
  STATUSES,
  formatCurrency,
  projectForecast,
  startOfWeek,
  hoursInWeek,
  toISO,
  addWeeks,
} from "@/lib/planner";

const BLANK: Omit<Project, "id"> = {
  name: "",
  code: "",
  status: "Planning",
  priority: 2,
  color: PROJECT_COLORS[0],
  startDate: toISO(startOfWeek(new Date())),
  endDate: toISO(addWeeks(startOfWeek(new Date()), 12)),
  manager: "",
  budget: null,
  tags: [],
};

const ALLOC_BLANK = {
  resourceId: "",
  projectId: "",
  hoursPerWeek: 20,
  startDate: toISO(startOfWeek(new Date())),
  endDate: toISO(addWeeks(startOfWeek(new Date()), 8)),
};

export default function ProjectsPage() {
  const { projects, resources, allocations, isLoading } = usePlanner();

  const [filter, setFilter] = useState("All");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<Omit<Project, "id">>(BLANK);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Allocation sheet
  const [allocSheetOpen, setAllocSheetOpen] = useState(false);
  const [allocProjectId, setAllocProjectId] = useState<string | null>(null);
  const [editingAlloc, setEditingAlloc] = useState<Allocation | null>(null);
  const [allocForm, setAllocForm] = useState(ALLOC_BLANK);
  const [savingAlloc, setSavingAlloc] = useState(false);
  const [deletingAlloc, setDeletingAlloc] = useState<string | null>(null);

  const thisWeek = startOfWeek(new Date());

  const filtered = filter === "All" ? projects : projects.filter((p) => p.status === filter);

  const counts = ["All", ...STATUSES].reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === "All" ? projects.length : projects.filter((p) => p.status === s).length;
    return acc;
  }, {});

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setSheetOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      status: p.status,
      priority: p.priority,
      color: p.color,
      startDate: p.startDate,
      endDate: p.endDate,
      manager: p.manager ?? "",
      budget: p.budget ?? null,
      tags: p.tags ?? [],
    });
    setSheetOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = { ...form, budget: form.budget || null };
    if (editing) {
      await fetch(`/api/projects/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: crypto.randomUUID() }),
      });
    }
    await mutate("/api/projects");
    setSheetOpen(false);
    setSaving(false);
  }

  async function del(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    await mutate("/api/projects");
    setDeleting(null);
  }

  // Allocation management
  function openAllocSheet(projectId: string) {
    setAllocProjectId(projectId);
    setEditingAlloc(null);
    setAllocForm({ ...ALLOC_BLANK, projectId });
    setAllocSheetOpen(true);
  }

  function openEditAlloc(a: Allocation) {
    setEditingAlloc(a);
    setAllocForm({
      resourceId: a.resourceId,
      projectId: a.projectId,
      hoursPerWeek: a.hoursPerWeek,
      startDate: a.startDate,
      endDate: a.endDate,
    });
    setAllocSheetOpen(true);
  }

  async function saveAlloc() {
    setSavingAlloc(true);
    if (editingAlloc) {
      await fetch(`/api/allocations/${editingAlloc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allocForm),
      });
    } else {
      await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...allocForm, id: crypto.randomUUID() }),
      });
    }
    await mutate("/api/allocations");
    setEditingAlloc(null);
    setAllocForm({ ...ALLOC_BLANK, projectId: allocProjectId ?? "" });
    setSavingAlloc(false);
  }

  async function delAlloc(id: string) {
    await fetch(`/api/allocations/${id}`, { method: "DELETE" });
    await mutate("/api/allocations");
    setDeletingAlloc(null);
  }

  const allocsForProject = allocations.filter((a) => a.projectId === allocProjectId);
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Portfolio of work competing for the same people.
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add project
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-0 border-b">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              filter === s
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
            <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">
              ({counts[s]})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <p>No projects found.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Add your first project
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Priority</th>
                <th className="px-3 py-2 text-left font-medium">Manager</th>
                <th className="px-3 py-2 text-left font-medium">Timeline</th>
                <th className="px-3 py-2 text-right font-medium">Staffed (this wk)</th>
                <th className="px-3 py-2 text-right font-medium">Budget / Forecast</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const projAllocs = allocations.filter((a) => a.projectId === p.id);
                const hoursThisWeek = projAllocs.reduce(
                  (s, a) => s + hoursInWeek(a, thisWeek),
                  0
                );
                const people = new Set(projAllocs.map((a) => a.resourceId)).size;
                const forecast = projectForecast(p.id, allocations, resources);
                const over = !!p.budget && forecast > p.budget;
                return (
                  <tr key={p.id} className="group hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.code}
                            {(p.tags ?? []).map((t) => (
                              <span
                                key={t}
                                className="ml-1.5 rounded border px-1 py-0 text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {PRIORITY_LABELS[p.priority]}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.manager || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {p.startDate} → {p.endDate}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {hoursThisWeek}h · {(hoursThisWeek / 40).toFixed(1)} FTE · {people}{" "}
                      {people === 1 ? "person" : "people"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {p.budget ? (
                        <div>
                          <div className="tabular-nums">
                            {formatCurrency(forecast)} / {formatCurrency(p.budget)}
                          </div>
                          <div
                            className={`text-xs tabular-nums ${over ? "font-semibold text-red-600" : "text-emerald-700"}`}
                          >
                            {over ? "Over" : "Under"} by{" "}
                            {formatCurrency(Math.abs(forecast - p.budget))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {forecast > 0 ? formatCurrency(forecast) : "—"} / no budget
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openAllocSheet(p.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Manage allocations"
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded p-1 hover:bg-accent"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {deleting === p.id ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => del(p.id)}
                              className="rounded bg-destructive px-1.5 py-0.5 text-white hover:opacity-90"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleting(null)}
                              className="rounded px-1.5 py-0.5 hover:bg-accent"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleting(p.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Project Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit project" : "New project"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-code">Code</Label>
                <Input
                  id="p-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="PROJ"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-status">Status</Label>
                <select
                  id="p-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as Project["status"] })
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-priority">Priority</Label>
                <select
                  id="p-priority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) as 1 | 2 | 3 })
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={1}>P1 — Critical</option>
                  <option value={2}>P2 — High</option>
                  <option value={3}>P3 — Normal</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-manager">Manager</Label>
                <Input
                  id="p-manager"
                  value={form.manager ?? ""}
                  onChange={(e) => setForm({ ...form, manager: e.target.value })}
                  placeholder="Owner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-budget">Budget (USD)</Label>
                <Input
                  id="p-budget"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.budget ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, budget: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="No budget"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-start">Start date</Label>
                <Input
                  id="p-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-end">End date</Label>
                <Input
                  id="p-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-tags">Tags (comma-separated)</Label>
              <Input
                id="p-tags"
                value={(form.tags ?? []).join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim().toLowerCase())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g. customer, web"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-6 w-6 rounded-sm ring-offset-2 transition-transform ${
                      form.color === c ? "scale-110 ring-2 ring-ring" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.name || !form.code}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add project"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Allocation Sheet */}
      <Sheet open={allocSheetOpen} onOpenChange={setAllocSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Allocations —{" "}
              {projects.find((p) => p.id === allocProjectId)?.name ?? ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            {/* Existing allocations */}
            {allocsForProject.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current allocations
                </p>
                {allocsForProject.map((a) => {
                  const res = resourceMap.get(a.resourceId);
                  return (
                    <div
                      key={a.id}
                      className="group flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{res?.name ?? a.resourceId}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.hoursPerWeek}h/wk · {a.startDate} → {a.endDate}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEditAlloc(a)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {deletingAlloc === a.id ? (
                          <>
                            <button
                              onClick={() => delAlloc(a.id)}
                              className="rounded bg-destructive px-1.5 py-0.5 text-xs text-white"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeletingAlloc(null)}
                              className="rounded px-1.5 py-0.5 text-xs hover:bg-accent"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeletingAlloc(a.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add / edit allocation form */}
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">
                {editingAlloc ? "Edit allocation" : "Add allocation"}
              </p>
              <div className="space-y-1.5">
                <Label>Resource</Label>
                <select
                  value={allocForm.resourceId}
                  onChange={(e) => setAllocForm({ ...allocForm, resourceId: e.target.value })}
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
                <Label>Hours per week</Label>
                <Input
                  type="number"
                  min={1}
                  max={80}
                  value={allocForm.hoursPerWeek}
                  onChange={(e) =>
                    setAllocForm({ ...allocForm, hoursPerWeek: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input
                    type="date"
                    value={allocForm.startDate}
                    onChange={(e) => setAllocForm({ ...allocForm, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input
                    type="date"
                    value={allocForm.endDate}
                    onChange={(e) => setAllocForm({ ...allocForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {editingAlloc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAlloc(null);
                      setAllocForm({ ...ALLOC_BLANK, projectId: allocProjectId ?? "" });
                    }}
                  >
                    Cancel edit
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={saveAlloc}
                  disabled={savingAlloc || !allocForm.resourceId || !allocForm.startDate}
                  className="flex-1"
                >
                  {savingAlloc
                    ? "Saving…"
                    : editingAlloc
                      ? "Save changes"
                      : "Add allocation"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
