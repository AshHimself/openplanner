"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomFieldDef } from "@/lib/planner";

// Renders dynamic inputs for a set of custom-field definitions, bound to a
// values object (the entity's customFields jsonb).
export function CustomFieldsInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Custom fields
      </p>
      {fields.map((f) => {
        const v = values?.[f.key];
        const id = `cf-${f.entity}-${f.key}`;
        return (
          <div key={f.id} className="space-y-1.5">
            <Label htmlFor={id}>{f.label}</Label>
            {f.type === "select" ? (
              <select
                id={id}
                value={(v as string) ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={(v as string | number) ?? ""}
                onChange={(e) =>
                  onChange(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Read-only display of custom field values (for profiles/detail views).
export function CustomFieldsDisplay({
  fields,
  values,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown> | null | undefined;
}) {
  const filled = fields.filter((f) => values?.[f.key] != null && values?.[f.key] !== "");
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {filled.map((f) => (
        <div key={f.id} className="rounded-md border px-3 py-1.5">
          <div className="text-[11px] text-muted-foreground">{f.label}</div>
          <div className="text-sm">{String(values?.[f.key])}</div>
        </div>
      ))}
    </div>
  );
}
