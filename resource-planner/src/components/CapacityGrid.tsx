import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanner } from "@/store";
import type { Allocation } from "@/types";
import { allocationHoursInWeek, formatWeek, getWeeks } from "@/lib/dates";
import { AllocationDialog } from "@/components/AllocationDialog";

const WEEK_COUNT = 12;

function cellStyle(hours: number, capacity: number): string {
  if (hours === 0) return "bg-transparent text-stone-300";
  const ratio = hours / capacity;
  if (ratio > 1) return "bg-red-100 text-red-900 font-semibold";
  if (ratio >= 0.85) return "bg-emerald-100 text-emerald-900";
  if (ratio >= 0.5) return "bg-teal-50 text-teal-900";
  return "bg-stone-100 text-stone-600";
}

export function CapacityGrid() {
  const { resources, projects, allocations } = usePlanner();
  const weeks = useMemo(() => getWeeks(WEEK_COUNT), []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allocation | null>(null);
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>();

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  );

  function toggle(resourceId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }

  function openNew(resourceId?: string) {
    setEditing(null);
    setDefaultResourceId(resourceId);
    setDialogOpen(true);
  }

  function openEdit(alloc: Allocation) {
    setEditing(alloc);
    setDefaultResourceId(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Capacity plan</h2>
          <p className="text-sm text-muted-foreground">
            Weekly allocated hours vs. capacity, next {WEEK_COUNT} weeks. Click a row to see the
            project breakdown; click a project cell range to edit.
          </p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="mr-1 h-4 w-4" /> Allocation
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-stone-100 ring-1 ring-stone-200" /> Under 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-teal-50 ring-1 ring-teal-200" /> 50–85%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" /> 85–100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-100 ring-1 ring-red-200" /> Overallocated
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-stone-50 text-left">
              <th className="sticky left-0 z-10 min-w-[220px] bg-stone-50 px-3 py-2 font-medium">
                Resource
              </th>
              {weeks.map((w) => (
                <th key={w.getTime()} className="min-w-[64px] px-1 py-2 text-center font-medium text-stone-600">
                  {formatWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => {
              const resourceAllocs = allocations.filter((a) => a.resourceId === r.id);
              const totals = weeks.map((w) =>
                resourceAllocs.reduce((sum, a) => sum + allocationHoursInWeek(a, w), 0)
              );
              const isOpen = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b transition-colors hover:bg-stone-50"
                    onClick={() => toggle(r.id)}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                        )}
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.role} · {r.capacity}h/wk
                          </div>
                        </div>
                      </div>
                    </td>
                    {totals.map((h, i) => (
                      <td key={i} className="border-l px-1 py-1 text-center">
                        <div
                          className={`mx-auto rounded-sm px-1 py-1 tabular-nums ${cellStyle(h, r.capacity)}`}
                          title={`${h}h of ${r.capacity}h`}
                        >
                          {h > 0 ? h : "·"}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <>
                      {resourceAllocs.map((a) => {
                        const proj = projectById[a.projectId];
                        if (!proj) return null;
                        return (
                          <tr
                            key={a.id}
                            className="cursor-pointer border-b bg-stone-50/60 text-xs hover:bg-stone-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(a);
                            }}
                          >
                            <td className="sticky left-0 z-10 bg-stone-50 py-1.5 pl-10 pr-3">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                                  style={{ backgroundColor: proj.color }}
                                />
                                {proj.name}
                              </span>
                            </td>
                            {weeks.map((w, i) => {
                              const h = allocationHoursInWeek(a, w);
                              return (
                                <td key={i} className="border-l px-1 py-1 text-center tabular-nums">
                                  {h > 0 ? (
                                    <span
                                      className="inline-block w-full rounded-sm py-0.5 text-white"
                                      style={{ backgroundColor: proj.color }}
                                    >
                                      {h}
                                    </span>
                                  ) : (
                                    <span className="text-stone-300">·</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="border-b bg-stone-50/60">
                        <td className="sticky left-0 z-10 bg-stone-50 py-1 pl-10 pr-3" colSpan={1}>
                          <button
                            className="text-xs text-teal-700 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNew(r.id);
                            }}
                          >
                            + Allocate {r.name.split(" ")[0]} to a project
                          </button>
                        </td>
                        <td colSpan={WEEK_COUNT} />
                      </tr>
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <AllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        allocation={editing}
        defaultResourceId={defaultResourceId}
      />
    </div>
  );
}
