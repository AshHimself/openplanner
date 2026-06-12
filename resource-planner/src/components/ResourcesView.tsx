import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { newId, usePlanner } from "@/store";
import type { Resource } from "@/types";
import { allocationHoursInWeek, startOfWeek } from "@/lib/dates";
import { fmtCurrency } from "@/lib/costs";

export function ResourcesView() {
  const { resources, allocations, saveResource, deleteResource } = usePlanner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const thisWeek = useMemo(() => startOfWeek(new Date()), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resources</h2>
          <p className="text-sm text-muted-foreground">
            The people available to staff against the portfolio.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Resource
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Day rate</TableHead>
              <TableHead className="w-[220px]">Utilization (this wk)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((r) => {
              const hours = allocations
                .filter((a) => a.resourceId === r.id)
                .reduce((sum, a) => sum + allocationHoursInWeek(a, thisWeek), 0);
              const pct = Math.round((hours / r.capacity) * 100);
              const over = pct > 100;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.team}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.capacity}h/wk</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.dayRate ? `${fmtCurrency(r.dayRate)}/day` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className={`h-full ${over ? "bg-red-500" : pct >= 85 ? "bg-emerald-500" : "bg-teal-600"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`w-12 text-right text-xs tabular-nums ${over ? "font-semibold text-red-600" : "text-muted-foreground"}`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(r);
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

      <ResourceDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editing}
        onSave={saveResource}
        onDelete={deleteResource}
      />
    </div>
  );
}

function ResourceDialog({
  open,
  onOpenChange,
  resource,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resource: Resource | null;
  onSave: (r: Resource) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(resource?.name ?? "");
  const [role, setRole] = useState(resource?.role ?? "");
  const [team, setTeam] = useState(resource?.team ?? "");
  const [capacity, setCapacity] = useState(String(resource?.capacity ?? 40));
  const [dayRate, setDayRate] = useState(resource?.dayRate ? String(resource.dayRate) : "");

  const valid = name.trim() && role.trim() && Number(capacity) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit resource" : "New resource"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Team</Label>
              <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team" />
            </div>
            <div className="grid gap-1.5">
              <Label>Capacity (h/wk)</Label>
              <Input
                type="number"
                min={1}
                max={80}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Day rate ($ per 8-hour day)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={dayRate}
              onChange={(e) => setDayRate(e.target.value)}
              placeholder="No rate"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {resource ? (
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(resource.id);
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
                id: resource?.id ?? newId("r"),
                name: name.trim(),
                role: role.trim(),
                team: team.trim(),
                capacity: Number(capacity),
                dayRate: Number(dayRate) > 0 ? Number(dayRate) : undefined,
              });
              onOpenChange(false);
            }}
          >
            Save resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
