"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  usePlanner,
  useRequirements,
  type Requirement,
} from "@/lib/planner";

export function ForecastRequirements() {
  const { projects, resources } = usePlanner();
  const { requirements, mutate } = useRequirements();

  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState("");
  const [fte, setFte] = useState("1");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  // Distinct roles from resources (for the datalist suggestions)
  const roleOptions = useMemo(
    () => [...new Set(resources.map((r) => r.role))].sort(),
    [resources]
  );

  const reqsByProject = useMemo(() => {
    const m = new Map<string, Requirement[]>();
    for (const r of requirements) {
      if (!m.has(r.projectId)) m.set(r.projectId, []);
      m.get(r.projectId)!.push(r);
    }
    return m;
  }, [requirements]);

  async function add() {
    if (!projectId || !role.trim() || !(Number(fte) > 0)) return;
    setSaving(true);
    try {
      await fetch("/api/requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          role: role.trim(),
          fte: Number(fte),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      await mutate();
      setRole("");
      setFte("1");
      setTags("");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/requirements/${id}`, { method: "DELETE" });
    await mutate();
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1.2fr_0.6fr_1.2fr_auto]">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.code}] {p.name}
            </option>
          ))}
        </select>
        <Input
          list="role-suggestions"
          placeholder="Role (e.g. Project Manager)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <datalist id="role-suggestions">
          {roleOptions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Input
          type="number"
          step="0.25"
          min="0.25"
          placeholder="FTE"
          value={fte}
          onChange={(e) => setFte(e.target.value)}
          title="Full-time equivalents (1.0 = 40h/wk)"
        />
        <Input
          placeholder="Skills (comma-sep, optional)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Button size="sm" onClick={add} disabled={saving || !projectId || !role.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Existing requirements grouped by project */}
      {requirements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No requirements yet. Define what roles each project needs (e.g. 0.5 PM, 2.0 Engineer) so
          the forecast can find gaps.
        </p>
      ) : (
        <div className="space-y-3">
          {[...reqsByProject.entries()].map(([pid, reqs]) => {
            const p = projects.find((x) => x.id === pid);
            return (
              <div key={pid} className="rounded-md border px-3 py-2">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  {p && (
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                  )}
                  {p?.name ?? pid}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {reqs.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs"
                    >
                      <span className="font-medium">{r.fte} FTE</span>
                      {r.role}
                      {(r.tags ?? []).length > 0 && (
                        <span className="flex gap-1">
                          {(r.tags ?? []).map((t) => (
                            <Badge key={t} variant="outline" className="px-1 py-0 text-[9px]">
                              {t}
                            </Badge>
                          ))}
                        </span>
                      )}
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
