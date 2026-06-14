"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  usePlanner,
  type Resource,
  startOfWeek,
  hoursInWeek,
  toISO,
  addWeeks,
  formatDate,
} from "@/lib/planner";
import { ResourceProfile } from "@/components/resource-profile";
import { TableSkeleton } from "@/components/skeletons";
import { useCustomFields } from "@/lib/planner";
import { CustomFieldsInputs } from "@/components/custom-fields-form";
import { usePermissions } from "@/lib/use-permissions";

const BLANK: Omit<Resource, "id"> = {
  name: "",
  role: "",
  team: "",
  capacity: 40,
  dayRate: null,
  avatarUrl: "",
  tags: [],
  startDate: null,
  endDate: null,
  customFields: {},
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function utilizationColor(pct: number): string {
  if (pct === 0) return "text-muted-foreground";
  if (pct > 100) return "text-red-600 font-semibold";
  if (pct >= 85) return "text-emerald-700";
  if (pct >= 50) return "text-teal-700";
  return "text-muted-foreground";
}

export default function ResourcesPage() {
  const { resources, projects, allocations, isLoading } = usePlanner();
  const { resourceFields } = useCustomFields();
  const { can } = usePermissions();

  const [teamFilter, setTeamFilter] = useState("All");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<Omit<Resource, "id">>(BLANK);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const thisWeek = startOfWeek(new Date());
  const teams = ["All", ...Array.from(new Set(resources.map((r) => r.team))).sort()];

  const filtered =
    teamFilter === "All" ? resources : resources.filter((r) => r.team === teamFilter);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setSheetOpen(true);
  }

  function openEdit(r: Resource) {
    setEditing(r);
    setForm({
      name: r.name,
      role: r.role,
      team: r.team,
      capacity: r.capacity,
      dayRate: r.dayRate ?? null,
      avatarUrl: r.avatarUrl ?? "",
      tags: r.tags ?? [],
      startDate: r.startDate ?? null,
      endDate: r.endDate ?? null,
      customFields: r.customFields ?? {},
    });
    setSheetOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      dayRate: form.dayRate || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    if (editing) {
      await fetch(`/api/resources/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: crypto.randomUUID() }),
      });
    }
    await mutate("/api/resources");
    setSheetOpen(false);
    setSaving(false);
  }

  async function del(id: string) {
    await fetch(`/api/resources/${id}`, { method: "DELETE" });
    await mutate("/api/resources");
    setDeleting(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-md bg-primary/10" />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resources</h2>
          <p className="text-sm text-muted-foreground">
            {resources.length} people · {resources.reduce((s, r) => s + r.capacity, 0)}h total
            weekly capacity
          </p>
        </div>
        {can("resources.edit") && (
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add resource
          </Button>
        )}
      </div>

      {/* Team filter tabs */}
      {teams.length > 2 && (
        <div className="flex flex-wrap gap-0 border-b">
          {teams.map((t) => (
            <button
              key={t}
              onClick={() => setTeamFilter(t)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                teamFilter === t
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <p>No resources found.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Add your first resource
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Resource</th>
                <th className="px-3 py-2 text-left font-medium">Team</th>
                <th className="px-3 py-2 text-right font-medium">Capacity</th>
                <th className="px-3 py-2 text-right font-medium">Allocated (this wk)</th>
                <th className="px-3 py-2 text-right font-medium">Day rate</th>
                <th className="px-3 py-2 text-left font-medium">Projects</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const resAllocs = allocations.filter((a) => a.resourceId === r.id);
                const allocated = resAllocs.reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
                const pct = r.capacity > 0 ? Math.round((allocated / r.capacity) * 100) : 0;
                const activeProjects = resAllocs
                  .map((a) => projectById.get(a.projectId))
                  .filter(Boolean);
                return (
                  <tr key={r.id} className="group hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(r.name)}
                        </div>
                        <div>
                          <button
                            onClick={() => setProfileId(r.id)}
                            className="font-medium hover:underline text-left"
                          >
                            {r.name}
                          </button>
                          <div className="text-xs text-muted-foreground">
                            {r.role}
                            {r.endDate && (
                              <span className="ml-1.5 rounded bg-amber-100 px-1 py-0 text-[10px] text-amber-700">
                                until {formatDate(r.endDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.team}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.capacity}h/wk
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${utilizationColor(pct)}`}>
                      {allocated}h ({pct}%)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.dayRate ? `$${r.dayRate.toLocaleString()}/day` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {activeProjects.slice(0, 3).map((p) =>
                          p ? (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-sm"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.code}
                            </span>
                          ) : null
                        )}
                        {activeProjects.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{activeProjects.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded p-1 hover:bg-accent"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {deleting === r.id ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => del(r.id)}
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
                            onClick={() => setDeleting(r.id)}
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

      {/* Resource Profile */}
      <ResourceProfile resourceId={profileId} onOpenChange={(o) => !o && setProfileId(null)} />

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit resource" : "New resource"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Full name</Label>
              <Input
                id="r-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-role">Role</Label>
                <Input
                  id="r-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Frontend Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-team">Team</Label>
                <Input
                  id="r-team"
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  placeholder="Engineering"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-capacity">Capacity (h/wk)</Label>
                <Input
                  id="r-capacity"
                  type="number"
                  min={1}
                  max={80}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-rate">Day rate (USD)</Label>
                <Input
                  id="r-rate"
                  type="number"
                  min={0}
                  step={50}
                  value={form.dayRate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dayRate: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="No rate"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-tags">Tags (comma-separated)</Label>
              <Input
                id="r-tags"
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
                placeholder="e.g. senior, fullstack"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-start">Available from</Label>
                <Input
                  id="r-start"
                  type="date"
                  value={form.startDate ?? ""}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-end">Available until</Label>
                <Input
                  id="r-end"
                  type="date"
                  value={form.endDate ?? ""}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value || null })}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Leave blank for permanent staff. Set an end date for contractors or fixed-term
              resources so forecasts know when they finish.
            </p>
            <CustomFieldsInputs
              fields={resourceFields}
              values={(form.customFields as Record<string, unknown>) ?? {}}
              onChange={(key, value) =>
                setForm({ ...form, customFields: { ...(form.customFields ?? {}), [key]: value } })
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving || !form.name || !form.role || !form.team}
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add resource"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
