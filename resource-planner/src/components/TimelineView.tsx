import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { usePlanner } from "@/store";
import type { Project } from "@/types";
import { addWeeks, formatDate, parseISO, startOfWeek, toISO } from "@/lib/dates";
import { statusBadgeClass, collectTags } from "@/lib/status";
import { TagFilter } from "@/components/TagFilter";
import { ProjectProfile } from "@/components/ProjectProfile";

const LEFT_W = 300; // px for the project list panel
const ROW_H = 52;

type Scale = "week" | "month" | "quarter";
/** Minimum px per week; the chart stretches to fill the container beyond this. */
const MIN_PX_PER_WEEK: Record<Scale, number> = { week: 44, month: 10, quarter: 5 };

type DragMode = "move" | "start" | "end";

interface DragState {
  projectId: string;
  mode: DragMode;
  originX: number;
  deltaWeeks: number;
}

function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function bandKey(weekStart: Date, scale: Scale): string {
  if (scale === "quarter") {
    return `Q${Math.floor(weekStart.getMonth() / 3) + 1} ${weekStart.getFullYear()}`;
  }
  return weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function bandText(key: string, widthPx: number, scale: Scale): string {
  if (widthPx >= 88) return key; // "June 2026" / "Q2 2026"
  if (widthPx >= 34) return scale === "quarter" ? key.split(" ")[0] : key.slice(0, 3); // "Q2" / "Jun"
  return "";
}

export function TimelineView() {
  const { projects, saveProject } = usePlanner();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState<Scale>("week");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Measure the view root (never gains scrollbars itself) so the chart can
  // stretch to fill it without a measure→scrollbar→measure feedback loop.
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const allTags = useMemo(() => collectTags(projects), [projects]);
  const visible = useMemo(
    () =>
      selectedTags.size === 0
        ? projects
        : projects.filter((p) => (p.tags ?? []).some((t) => selectedTags.has(t))),
    [projects, selectedTags]
  );

  const today = new Date();
  const currentMonday = startOfWeek(today);

  // Timeline range: fit the *visible* (filtered) projects with margin, always include today
  const { timelineStart, weekCount, weeks } = useMemo(() => {
    let start = addWeeks(currentMonday, -2);
    let end = addWeeks(currentMonday, 8);
    for (const p of visible) {
      const s = startOfWeek(parseISO(p.startDate));
      const e = startOfWeek(parseISO(p.endDate));
      if (s < start) start = addWeeks(s, -1);
      if (e > end) end = addWeeks(e, 2);
    }
    const count = Math.min(weeksBetween(start, end) + 1, 80);
    return {
      timelineStart: start,
      weekCount: count,
      weeks: Array.from({ length: count }, (_, i) => addWeeks(start, i)),
    };
  }, [visible, currentMonday]);

  // Stretch to fill the container; never below the scale's minimum density.
  // The 20px allowance absorbs card borders and any scrollbar that appears
  // after measurement, so the fitted chart can never trigger its own
  // horizontal scrollbar (which would re-shrink the container — a feedback loop).
  const pxPerWeek = useMemo(() => {
    const min = MIN_PX_PER_WEEK[scale];
    if (!containerW) return min;
    return Math.max(min, (containerW - LEFT_W - 20) / weekCount);
  }, [containerW, scale, weekCount]);

  const bands = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const w of weeks) {
      const label = bandKey(w, scale);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.count += 1;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [weeks, scale]);

  // Cumulative pixel offsets of band boundaries (for gridlines in month/quarter scale)
  const bandBoundaries = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const g of bands) {
      acc += g.count * pxPerWeek;
      out.push(acc);
    }
    return out;
  }, [bands, pxPerWeek]);

  const chartW = weekCount * pxPerWeek;
  const todayOffset = ((today.getTime() - timelineStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) * pxPerWeek;
  const headerH = scale === "week" ? 52 : 30; // month band + week row, or band only

  function shiftedDates(p: Project): { start: Date; end: Date } {
    let start = parseISO(p.startDate);
    let end = parseISO(p.endDate);
    if (drag && drag.projectId === p.id && drag.deltaWeeks !== 0) {
      if (drag.mode !== "end") start = addWeeks(start, drag.deltaWeeks);
      if (drag.mode !== "start") end = addWeeks(end, drag.deltaWeeks);
      if (end < start) (drag.mode === "start" ? (start = end) : (end = start));
    }
    return { start, end };
  }

  function beginDrag(e: React.PointerEvent, p: Project, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // synthetic events or exotic pointers may not support capture; drag still works
    }
    const state = { projectId: p.id, mode, originX: e.clientX, deltaWeeks: 0 };
    dragRef.current = state;
    setDrag(state);
  }

  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const deltaWeeks = Math.round((e.clientX - d.originX) / pxPerWeek);
    if (deltaWeeks !== d.deltaWeeks) {
      const next = { ...d, deltaWeeks };
      dragRef.current = next;
      setDrag(next);
    }
  }

  function endDrag(p: Project) {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.deltaWeeks === 0) return;
    const { start, end } = (() => {
      let start = parseISO(p.startDate);
      let end = parseISO(p.endDate);
      if (d.mode !== "end") start = addWeeks(start, d.deltaWeeks);
      if (d.mode !== "start") end = addWeeks(end, d.deltaWeeks);
      if (end < start) (d.mode === "start" ? (start = end) : (end = start));
      return { start, end };
    })();
    saveProject({ ...p, startDate: toISO(start), endDate: toISO(end) });
  }

  const totalH = headerH + visible.length * ROW_H;

  return (
    <div ref={rootRef} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Drag a bar to reschedule a project; drag its edges to change start or end. Changes
            snap to weeks.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-md border p-0.5">
            {(["week", "month", "quarter"] as Scale[]).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  scale === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <TagFilter
            allTags={allTags}
            selected={selectedTags}
            onToggle={(tag) =>
              setSelectedTags((prev) => {
                const next = new Set(prev);
                if (next.has(tag)) next.delete(tag);
                else next.add(tag);
                return next;
              })
            }
            onClear={() => setSelectedTags(new Set())}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <div className="relative" style={{ minWidth: LEFT_W + chartW }}>
          {/* Band header (months or quarters) */}
          <div className="flex border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <div
              className="sticky left-0 z-20 shrink-0 border-r bg-muted px-3 py-1.5"
              style={{ width: LEFT_W }}
            >
              Project
            </div>
            {bands.map((g, i) => (
              <div
                key={i}
                className="overflow-hidden whitespace-nowrap border-r py-1.5 text-center"
                style={{ width: g.count * pxPerWeek }}
              >
                {bandText(g.label, g.count * pxPerWeek, scale)}
              </div>
            ))}
          </div>
          {/* Week header (week scale only) */}
          {scale === "week" && (
            <div className="flex border-b text-[10px] text-muted-foreground">
              <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LEFT_W }} />
              {weeks.map((w) => (
                <div
                  key={w.getTime()}
                  className="shrink-0 border-r py-1 text-center"
                  style={{ width: pxPerWeek }}
                >
                  {w.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          {visible.map((p) => {
            const { start, end } = shiftedDates(p);
            const rawStart = weeksBetween(timelineStart, startOfWeek(start));
            const rawEnd = rawStart + weeksBetween(startOfWeek(start), startOfWeek(end)) + 1;
            // Clamp to the (capped) visible range so bars never overflow the chart
            const startIdx = Math.max(rawStart, 0);
            const span = Math.min(rawEnd, weekCount) - startIdx;
            const isDragging = drag?.projectId === p.id;
            return (
              <div key={p.id} className="flex border-b last:border-b-0" style={{ height: ROW_H }}>
                <div
                  className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-0.5 border-r bg-card px-3"
                  style={{ width: LEFT_W }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    <button
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                      onClick={() => setProfileId(p.id)}
                    >
                      {p.name}
                    </button>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 px-1.5 text-[10px] ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                  {(p.tags ?? []).length > 0 && (
                    <div className="flex gap-1 overflow-hidden pl-[18px]">
                      {(p.tags ?? []).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="shrink-0 px-1.5 py-0 text-[9px] font-normal text-muted-foreground"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className="relative shrink-0"
                  style={{
                    width: chartW,
                    backgroundImage:
                      scale === "week"
                        ? `repeating-linear-gradient(to right, transparent 0 ${pxPerWeek - 1}px, hsl(var(--border) / 0.55) ${pxPerWeek - 1}px ${pxPerWeek}px)`
                        : undefined,
                  }}
                >
                  {/* Band gridlines for month/quarter scale */}
                  {scale !== "week" &&
                    bandBoundaries.slice(0, -1).map((x, i) => (
                      <div
                        key={i}
                        className="absolute bottom-0 top-0 w-px bg-border/70"
                        style={{ left: x }}
                      />
                    ))}
                  {/* Bar (hidden when entirely outside the visible range) */}
                  {span > 0 && (
                  <div
                    className={`group absolute flex items-center rounded-md text-xs font-medium text-white shadow-sm ${
                      isDragging
                        ? "z-10 cursor-grabbing shadow-md ring-2 ring-ring"
                        : "cursor-grab transition-[left,width,box-shadow] duration-300 ease-out hover:shadow-md"
                    }`}
                    style={{
                      left: startIdx * pxPerWeek + 2,
                      width: Math.max(span * pxPerWeek - 4, pxPerWeek - 4),
                      top: 10,
                      height: ROW_H - 20,
                      backgroundColor: p.color,
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => beginDrag(e, p, "move")}
                    onPointerMove={onDragMove}
                    onPointerUp={() => endDrag(p)}
                    onPointerCancel={() => endDrag(p)}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
                      onPointerDown={(e) => beginDrag(e, p, "start")}
                    />
                    {span * pxPerWeek > 60 && <span className="truncate px-2.5">{p.name}</span>}
                    <div
                      className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
                      onPointerDown={(e) => beginDrag(e, p, "end")}
                    />
                    {/* Date tooltip while dragging */}
                    {isDragging && (
                      <div className="absolute -top-7 left-0 z-20 whitespace-nowrap rounded-md border bg-popover px-2 py-0.5 text-[11px] font-normal text-popover-foreground shadow-md">
                        {formatDate(toISO(start))} → {formatDate(toISO(end))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No projects match the selected tags.
            </div>
          )}

          {/* Today marker — spans header and all rows */}
          {todayOffset >= 0 && todayOffset <= chartW && (
            <div
              className="pointer-events-none absolute top-0 z-10"
              style={{ left: LEFT_W + todayOffset, height: totalH }}
            >
              <div className="absolute bottom-0 top-0 w-[2px] bg-red-500" />
              <div className="absolute -left-[22px] top-0.5 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                Today
              </div>
            </div>
          )}
        </div>
      </div>

      <ProjectProfile projectId={profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </div>
  );
}
