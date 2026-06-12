import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { newId, usePlanner } from "@/store";
import type { Project, ProjectStatus } from "@/types";
import { allocationHoursInWeek, formatDate, startOfWeek, toISO, addWeeks } from "@/lib/dates";
import { fmtCurrency, projectForecast } from "@/lib/costs";

const STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed"];
const COLORS = ["#0e7490", "#9a3412", "#3f6212", "#86198f", "#1d4ed8", "#a16207", "#be123c", "#4338ca"];

function statusVariant(status: ProjectStatus): string {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "Planning":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "On Hold":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "Completed":
      return "bg-stone-200 text-stone-700 hover:bg-stone-200";
  }
}

export function ProjectsView() {
  const { projects, resources, allocations, saveProject, deleteProject } = usePlanner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const thisWeek = useMemo(() => startOfWeek(new Date()), []);

  function statsFor(projectId: string) {
    const projAllocs = allocations.filter((a) => a.projectId === projectId);
    const hoursThisWeek = projAllocs.reduce(
      (sum, a) => sum + allocationHoursInWeek(a, thisWeek),
      0
    );
    const people = new Set(projAllocs.map((a) => a.resourceId)).size;
    return { hoursThisWeek, people, fte: hoursThisWeek / 40 };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Portfolio of work competing for the same people.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Project
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead className="text-right">Staffed (this wk)</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => {
              const s = statsFor(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusVariant(p.status)} variant="secondary">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.priority === 1 ? "P1 — Critical" : p.priority === 2 ? "P2 — High" : "P3 — Normal"}
                  </TableCell>
                  <TableCell>{p.manager}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.hoursThisWeek}h · {s.fte.toFixed(1)} FTE · {s.people}{" "}
                    {s.people === 1 ? "person" : "people"}
                  </TableCell>
                  <TableCell className="text-right">
                    <BudgetCell
                      budget={p.budget}
                      forecast={projectForecast(p.id, allocations, resources)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(p);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ProjectDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editing}
        onSave={saveProject}
        onDelete={deleteProject}
      />
    </div>
  );
}

function BudgetCell({ budget, forecast }: { budget?: number; forecast: number }) {
  if (!budget) {
    return (
      <span className="text-sm text-muted-foreground" title="No budget set">
        {fmtCurrency(forecast)} / —
      </span>
    );
  }
  const over = forecast > budget;
  const variance = Math.abs(forecast - budget);
  return (
    <div className="space-y-0.5">
      <div className="whitespace-nowrap text-sm tabular-nums">
        {fmtCurrency(forecast)} / {fmtCurrency(budget)}
      </div>
      <div
        className={`whitespace-nowrap text-xs font-medium tabular-nums ${over ? "text-red-600" : "text-emerald-700"}`}
      >
        {over ? "Over by " : "Under by "}
        {fmtCurrency(variance)}
      </div>
    </div>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project | null;
  onSave: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  const monday = startOfWeek(new Date());
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Planning");
  const [priority, setPriority] = useState(String(project?.priority ?? 2));
  const [manager, setManager] = useState(project?.manager ?? "");
  const [startDate, setStartDate] = useState(project?.startDate ?? toISO(monday));
  const [endDate, setEndDate] = useState(project?.endDate ?? toISO(addWeeks(monday, 12)));
  const [color, setColor] = useState(project?.color ?? COLORS[0]);
  const [budget, setBudget] = useState(project?.budget ? String(project.budget) : "");

  const valid = name.trim() && code.trim() && startDate <= endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
            </div>
            <div className="grid gap-1.5">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC-123" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 — Critical</SelectItem>
                  <SelectItem value="2">P2 — High</SelectItem>
                  <SelectItem value="3">P3 — Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Manager</Label>
              <Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Owner" />
            </div>
            <div className="grid gap-1.5">
              <Label>Budget ($)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="No budget"
              />
            </div>
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
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-sm ring-offset-2 ${color === c ? "ring-2 ring-stone-900" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {project ? (
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(project.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={!valid}
            onClick={() => {
              onSave({
                id: project?.id ?? newId("p"),
                name: name.trim(),
                code: code.trim(),
                status,
                priority: Number(priority) as 1 | 2 | 3,
                manager: manager.trim(),
                startDate,
                endDate,
                color,
                budget: Number(budget) > 0 ? Number(budget) : undefined,
              });
              onOpenChange(false);
            }}
          >
            Save project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
