import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newId, usePlanner } from "@/store";
import type { Allocation } from "@/types";
import { addWeeks, startOfWeek, toISO } from "@/lib/dates";
import { allocationCost, allocationWeeks, fmtCurrency, projectForecast } from "@/lib/costs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing allocation to edit, or null to create. */
  allocation: Allocation | null;
  /** Preselected resource when creating from a grid row. */
  defaultResourceId?: string;
}

export function AllocationDialog({ open, onOpenChange, allocation, defaultResourceId }: Props) {
  const { resources, projects, allocations, saveAllocation, deleteAllocation } = usePlanner();
  const [resourceId, setResourceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("20");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    const monday = startOfWeek(new Date());
    setResourceId(allocation?.resourceId ?? defaultResourceId ?? resources[0]?.id ?? "");
    setProjectId(allocation?.projectId ?? projects[0]?.id ?? "");
    setHours(String(allocation?.hoursPerWeek ?? 20));
    setStartDate(allocation?.startDate ?? toISO(monday));
    setEndDate(allocation?.endDate ?? toISO(addWeeks(monday, 8)));
  }, [open, allocation, defaultResourceId, resources, projects]);

  const valid =
    resourceId && projectId && Number(hours) > 0 && startDate && endDate && startDate <= endDate;

  // Live budget impact of the allocation as currently drafted
  const draft: Allocation | null = valid
    ? {
        id: allocation?.id ?? "draft",
        resourceId,
        projectId,
        hoursPerWeek: Number(hours),
        startDate,
        endDate,
      }
    : null;
  const resource = resources.find((r) => r.id === resourceId);
  const project = projects.find((p) => p.id === projectId);
  const draftCost = draft ? allocationCost(draft, resource) : 0;
  const otherAllocations = allocations.filter((a) => a.id !== allocation?.id);
  const projectTotal = project
    ? projectForecast(project.id, otherAllocations, resources) + draftCost
    : 0;
  const overBudget = project?.budget ? projectTotal > project.budget : false;

  function handleSave() {
    if (!valid) return;
    saveAllocation({
      id: allocation?.id ?? newId("a"),
      resourceId,
      projectId,
      hoursPerWeek: Number(hours),
      startDate,
      endDate,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{allocation ? "Edit allocation" : "New allocation"}</DialogTitle>
          <DialogDescription>
            Assign a resource to a project for a span of weeks.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Resource</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select resource" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {r.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Hours per week</Label>
            <Input
              type="number"
              min={1}
              max={80}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>End</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {draft && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                overBudget ? "border-red-200 bg-red-50" : "border-stone-200 bg-stone-50"
              }`}
            >
              {resource?.dayRate ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cost of this allocation</span>
                    <span className="font-medium tabular-nums">
                      {fmtCurrency(draftCost)}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({allocationWeeks(draft)} wks × {Number(hours) / 8} d/wk ×{" "}
                        {fmtCurrency(resource.dayRate)})
                      </span>
                    </span>
                  </div>
                  {project?.budget ? (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">{project.code} forecast</span>
                      <span
                        className={`font-medium tabular-nums ${overBudget ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {fmtCurrency(projectTotal)} of {fmtCurrency(project.budget)}{" "}
                        {overBudget ? "— over budget" : "— within budget"}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {project?.code} has no budget set.
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {resource?.name} has no day rate set — this allocation won't count against the
                  project budget.
                </span>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {allocation ? (
            <Button
              variant="destructive"
              onClick={() => {
                deleteAllocation(allocation.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={!valid}>
            Save allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
