import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { A2UIComponent, A2UIForm, A2UIResponse } from "@/lib/ai";

// ── constants ──────────────────────────────────────────────────────────────

const ALERT_STYLES: Record<string, string> = {
  info:    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  error:   "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
};

const ALERT_ICONS = {
  info:    Info,
  warning: AlertTriangle,
  error:   AlertCircle,
  success: CheckCircle,
};

const FORM_COLORS = [
  "#0e7490","#9a3412","#3f6212","#86198f",
  "#1d4ed8","#a16207","#be123c","#4338ca",
];

// ── form component ─────────────────────────────────────────────────────────

function FormComponent({
  c,
  onSubmit,
}: {
  c: A2UIForm;
  onSubmit: (tool: string, data: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(c.fields.map((f) => [f.name, f.value !== undefined ? String(f.value) : ""]))
  );
  const [submitted, setSubmitted] = useState(false);

  function set(name: string, val: string) {
    setValues((prev) => ({ ...prev, [name]: val }));
  }

  function submit() {
    onSubmit(c.tool, values);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-xs italic text-muted-foreground">Submitted — see confirmation above.</p>
    );
  }

  return (
    <div className="space-y-3">
      {c.title && <div className="text-sm font-semibold">{c.title}</div>}

      {c.fields.map((f) => (
        <div key={f.name} className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">{f.label}</label>

          {f.type === "select" ? (
            <Select value={values[f.name]} onValueChange={(v) => set(f.name, v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(f.options ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === "color" ? (
            <div className="flex flex-wrap gap-1.5">
              {FORM_COLORS.map((hex) => (
                <button
                  key={hex}
                  title={hex}
                  className={`h-6 w-6 rounded-sm transition-transform hover:scale-110 ${
                    values[f.name] === hex ? "ring-2 ring-ring ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: hex }}
                  onClick={() => set(f.name, hex)}
                />
              ))}
            </div>
          ) : (
            <Input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              className="h-8 text-xs"
              value={values[f.name]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
        </div>
      ))}

      <Button size="sm" className="w-full" onClick={submit}>
        {c.submitLabel ?? "Submit"}
      </Button>
    </div>
  );
}

// ── generic component node ─────────────────────────────────────────────────

function ComponentNode({
  c,
  onFormSubmit,
}: {
  c: A2UIComponent;
  onFormSubmit: (tool: string, data: Record<string, unknown>) => void;
}) {
  switch (c.type) {
    case "text":
      return <p className="text-sm leading-relaxed">{c.content}</p>;

    case "alert": {
      const Icon = ALERT_ICONS[c.variant] ?? Info;
      return (
        <div className={`flex gap-2.5 rounded-md border px-3 py-2.5 text-sm ${ALERT_STYLES[c.variant]}`}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {c.title && <div className="font-semibold">{c.title}</div>}
            <div className={c.title ? "mt-0.5 opacity-90" : ""}>{c.body}</div>
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div className="overflow-hidden rounded-md border text-sm">
          {c.title && (
            <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium">
              {c.title}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {c.columns.map((col, i) => (
                  <TableHead key={i} className="h-8 text-xs">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="py-1.5 text-xs">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "card":
      return (
        <div className="rounded-md border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">{c.label}</div>
          <div className="text-base font-semibold tabular-nums">{c.value}</div>
          {c.subtext && (
            <div className="text-xs text-muted-foreground">{c.subtext}</div>
          )}
        </div>
      );

    case "list":
      return (
        <div>
          {c.title && <div className="mb-1.5 text-xs font-medium">{c.title}</div>}
          <ul className="space-y-1.5 text-sm">
            {c.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "action":
      return (
        <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{c.label}</div>
            <div className="text-xs text-emerald-800 opacity-90 dark:text-emerald-200">{c.detail}</div>
          </div>
        </div>
      );

    case "form":
      return <FormComponent c={c} onSubmit={onFormSubmit} />;

    default:
      return null;
  }
}

// ── renderer ───────────────────────────────────────────────────────────────

export function A2UIRenderer({
  response,
  onFormSubmit,
}: {
  response: A2UIResponse;
  onFormSubmit: (tool: string, data: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      {response.components.map((c, i) => (
        <ComponentNode key={i} c={c} onFormSubmit={onFormSubmit} />
      ))}
    </div>
  );
}
