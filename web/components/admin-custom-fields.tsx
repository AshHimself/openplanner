"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCustomFields, type CustomFieldDef } from "@/lib/planner";

const TYPES = ["text", "number", "date", "select"] as const;

export function AdminCustomFields() {
  const { resourceFields, projectFields, mutate } = useCustomFields();
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Define extra fields that appear on the Resources and Projects forms. Values are saved per
        record.
      </p>
      <EntitySection entity="resource" title="Resource fields" fields={resourceFields} onChange={mutate} />
      <EntitySection entity="project" title="Project fields" fields={projectFields} onChange={mutate} />
    </div>
  );
}

function EntitySection({
  entity,
  title,
  fields,
  onChange,
}: {
  entity: "resource" | "project";
  title: string;
  fields: CustomFieldDef[];
  onChange: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("text");
  const [options, setOptions] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!label.trim()) return;
    setSaving(true);
    await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entity,
        label: label.trim(),
        type,
        options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      }),
    });
    await onChange();
    setLabel("");
    setOptions("");
    setType("text");
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    await onChange();
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>

      {/* existing */}
      {fields.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No custom fields yet.</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          {fields.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 py-1 pl-2.5 pr-1 text-sm">
              <span className="font-medium">{f.label}</span>
              <Badge variant="outline" className="px-1 py-0 text-[10px]">{f.type}</Badge>
              {f.type === "select" && (f.options ?? []).length > 0 && (
                <span className="text-[10px] text-muted-foreground">[{(f.options ?? []).join(", ")}]</span>
              )}
              <button
                onClick={() => remove(f.id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                title="Delete field"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* add form */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Department" className="h-9 w-48" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {type === "select" && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Options (comma-separated)</label>
            <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Eng, Design, Ops" className="h-9 w-56" />
          </div>
        )}
        <Button size="sm" onClick={add} disabled={saving || !label.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Add field
        </Button>
      </div>
    </div>
  );
}
