"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { mutate } from "swr";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  usePlanner,
  startOfWeek,
  toISO,
  parseLocalDate,
  formatWeek,
  formatDate,
} from "@/lib/planner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

function currentMonday(): string {
  return toISO(startOfWeek(new Date()));
}

export function LogTimeSheet({ open, onOpenChange, defaultProjectId }: Props) {
  const { data: session } = useSession();
  const { projects, resources } = usePlanner();

  const userRole = (session?.user as { role?: string })?.role ?? "viewer";
  const userName = session?.user?.name ?? "";
  const isPlanner = userRole === "planner" || userRole === "admin";

  // Find the resource that matches the logged-in user's name
  const myResource = useMemo(
    () =>
      resources.find((r) => r.name.toLowerCase() === userName.toLowerCase()) ?? null,
    [resources, userName]
  );

  const [weekOf, setWeekOf] = useState(currentMonday());
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [resourceId, setResourceId] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // When dialog opens, reset to sensible defaults
  useEffect(() => {
    if (open) {
      setWeekOf(currentMonday());
      setProjectId(defaultProjectId ?? "");
      setResourceId(myResource?.id ?? "");
      setHours("");
      setNotes("");
      setError(null);
      setSuccess(false);
    }
  }, [open, defaultProjectId, myResource]);

  // Snap date input to Monday of selected week
  function handleDateChange(val: string) {
    if (!val) return;
    const d = parseLocalDate(val);
    setWeekOf(toISO(startOfWeek(d)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectId) { setError("Please select a project."); return; }
    if (!hours || Number(hours) <= 0) { setError("Enter a positive number of hours."); return; }
    if (Number(hours) > 168) { setError("Hours cannot exceed 168 per week."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          resourceId: resourceId || null,
          weekOf,
          hoursLogged: Number(hours),
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      await mutate("/api/timesheets");
      setSuccess(true);
      // Reset form for quick repeat-entry — but keep project + resource
      setWeekOf(currentMonday());
      setHours("");
      setNotes("");
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === projectId);
  const weekLabel = weekOf ? `Week of ${formatWeek(parseLocalDate(weekOf))}` : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Log Time
          </SheetTitle>
          <SheetDescription>
            {isPlanner
              ? "Record actual hours logged against a project."
              : "Log your hours against a project for the selected week."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Week */}
          <div className="space-y-1.5">
            <Label htmlFor="lt-week">Week</Label>
            <Input
              id="lt-week"
              type="date"
              value={weekOf}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
            {weekOf && (
              <p className="text-xs text-muted-foreground">{weekLabel}</p>
            )}
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label htmlFor="lt-project">Project</Label>
            <select
              id="lt-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              disabled={!!defaultProjectId}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedProject.startDate)} → {formatDate(selectedProject.endDate)}
              </p>
            )}
          </div>

          {/* Resource */}
          <div className="space-y-1.5">
            <Label htmlFor="lt-resource">
              Resource
              {!isPlanner && (
                <span className="ml-1.5 text-xs text-muted-foreground">(your profile)</span>
              )}
            </Label>
            {!isPlanner && myResource ? (
              // Engineers: show their own resource, locked
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                {myResource.name}
                <span className="ml-1.5 text-xs opacity-60">· {myResource.role}</span>
              </div>
            ) : (
              <select
                id="lt-resource"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">No specific resource</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.role}
                  </option>
                ))}
              </select>
            )}
            {!isPlanner && !myResource && (
              <p className="text-xs text-amber-600">
                Your name ({userName || "unknown"}) doesn't match any resource profile. Ask a
                planner to align your account name with your resource entry.
              </p>
            )}
          </div>

          {/* Hours */}
          <div className="space-y-1.5">
            <Label htmlFor="lt-hours">Hours logged</Label>
            <Input
              id="lt-hours"
              type="number"
              min="0.5"
              max="168"
              step="0.5"
              placeholder="e.g. 32"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="lt-notes">Notes (optional)</Label>
            <Textarea
              id="lt-notes"
              placeholder="Sprint 12, feature work…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Error / success */}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Time logged successfully.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Log Time"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
