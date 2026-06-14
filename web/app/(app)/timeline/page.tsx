"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import {
  usePlanner,
  startOfWeek,
  addWeeks,
  parseLocalDate,
  toISO,
  STATUS_COLORS,
} from "@/lib/planner";
import type { Project } from "@/lib/planner";
import { ProjectProfile } from "@/components/project-profile";
import { ChartSkeleton } from "@/components/skeletons";

const LEFT_W = 260;
const ROW_H = 52;
type Scale = "week" | "month" | "quarter";
const MIN_PX_PER_WEEK: Record<Scale, number> = { week: 44, month: 10, quarter: 5 };

function weeksBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function bandKey(w: Date, scale: Scale) {
  if (scale === "quarter") return `Q${Math.floor(w.getMonth() / 3) + 1} ${w.getFullYear()}`;
  return w.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function bandLabel(key: string, widthPx: number, scale: Scale) {
  if (widthPx >= 88) return key;
  if (widthPx >= 34) return scale === "quarter" ? key.split(" ")[0] : key.slice(0, 3);
  return "";
}

type DragMode = "move" | "start" | "end";
interface DragState {
  projectId: string;
  mode: DragMode;
  originX: number;
  deltaWeeks: number;
}

export default function TimelinePage() {
  const { projects, allocations, resources, isLoading } = usePlanner();
  const [scale, setScale] = useState<Scale>("month");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartW_px, setChartW_px] = useState(0);

  // Measure the scrollable chart area width (right panel)
  useLayoutEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartW_px(el.clientWidth));
    ro.observe(el);
    setChartW_px(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const today = new Date();
  const currentMonday = startOfWeek(today);

  const { timelineStart, weekCount, weeks } = useMemo(() => {
    let start = addWeeks(currentMonday, -2);
    let end = addWeeks(currentMonday, 8);
    for (const p of projects) {
      const s = startOfWeek(parseLocalDate(p.startDate));
      const e = startOfWeek(parseLocalDate(p.endDate));
      if (s < start) start = addWeeks(s, -1);
      if (e > end) end = addWeeks(e, 2);
    }
    const count = Math.min(weeksBetween(start, end) + 1, 104);
    return {
      timelineStart: start,
      weekCount: count,
      weeks: Array.from({ length: count }, (_, i) => addWeeks(start, i)),
    };
  }, [projects, currentMonday]);

  const pxPerWeek = useMemo(() => {
    const min = MIN_PX_PER_WEEK[scale];
    if (!chartW_px) return min;
    return Math.max(min, chartW_px / weekCount);
  }, [chartW_px, scale, weekCount]);

  const bands = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const w of weeks) {
      const label = bandKey(w, scale);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.count++;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [weeks, scale]);

  const totalChartW = weekCount * pxPerWeek;
  const todayOffset =
    ((today.getTime() - timelineStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) * pxPerWeek;

  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  function shiftedDates(p: Project): { start: Date; end: Date } {
    let start = parseLocalDate(p.startDate);
    let end = parseLocalDate(p.endDate);
    if (drag && drag.projectId === p.id && drag.deltaWeeks !== 0) {
      if (drag.mode !== "end") start = addWeeks(start, drag.deltaWeeks);
      if (drag.mode !== "start") end = addWeeks(end, drag.deltaWeeks);
      if (end < start) drag.mode === "start" ? (start = end) : (end = start);
    }
    return { start, end };
  }

  function beginDrag(e: React.PointerEvent, p: Project, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
    const state: DragState = { projectId: p.id, mode, originX: e.clientX, deltaWeeks: 0 };
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

  async function endDrag(p: Project) {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.deltaWeeks === 0) return;

    let start = parseLocalDate(p.startDate);
    let end = parseLocalDate(p.endDate);
    if (d.mode !== "end") start = addWeeks(start, d.deltaWeeks);
    if (d.mode !== "start") end = addWeeks(end, d.deltaWeeks);
    if (end < start) d.mode === "start" ? (start = end) : (end = start);

    await fetch(`/api/projects/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: toISO(start), endDate: toISO(end) }),
    });
    await mutate("/api/projects");
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-primary/10" />
        <div className="rounded-md border p-4">
          <ChartSkeleton rows={6} cols={14} />
        </div>
      </div>
    );
  }

  const headerH = scale === "week" ? 52 : 30;
  const totalH = headerH + projects.length * ROW_H;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Drag a bar to reschedule; drag its edges to change start or end. Snaps to weeks.
          </p>
        </div>
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
      </div>

      {/* Split-panel layout: fixed left labels + scrollable right chart */}
      <div className="flex rounded-md border bg-card" style={{ height: totalH }}>
        {/* ── LEFT PANEL (fixed width, no scroll) ── */}
        <div
          className="shrink-0 border-r bg-card"
          style={{ width: LEFT_W }}
        >
          {/* Left header */}
          <div
            className="flex items-center border-b bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
            style={{ height: headerH }}
          >
            Project
          </div>
          {/* Left rows */}
          {projects.map((p) => {
            const projAllocs = allocations.filter((a) => a.projectId === p.id);
            const assignedRes = [...new Set(projAllocs.map((a) => a.resourceId))]
              .map((id) => resourceMap.get(id))
              .filter(Boolean)
              .slice(0, 3);
            return (
              <div
                key={p.id}
                className="flex flex-col justify-center gap-0.5 border-b px-3 last:border-b-0"
                style={{ height: ROW_H }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <button
                    onClick={() => setProfileId(p.id)}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-left hover:underline"
                  >
                    {p.name}
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0 text-[10px] font-medium ${STATUS_COLORS[p.status]}`}
                  >
                    {p.status}
                  </span>
                </div>
                {assignedRes.length > 0 && (
                  <div className="flex gap-1 pl-[18px] text-[10px] text-muted-foreground">
                    {assignedRes.map((r) => r && (
                      <span key={r.id} className="truncate">{r.name.split(" ")[0]}</span>
                    ))}
                    {projAllocs.length > 3 && <span>+{projAllocs.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground px-3 text-center">
              No projects yet
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL (scrolls horizontally) ── */}
        <div ref={chartRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ minWidth: totalChartW, height: "100%" }}>
            {/* Band header */}
            <div
              className="flex border-b bg-muted/50 text-xs font-medium text-muted-foreground"
              style={{ height: scale === "week" ? 30 : headerH }}
            >
              {bands.map((g, i) => (
                <div
                  key={i}
                  className="overflow-hidden whitespace-nowrap border-r py-1.5 text-center"
                  style={{ width: g.count * pxPerWeek }}
                >
                  {bandLabel(g.label, g.count * pxPerWeek, scale)}
                </div>
              ))}
            </div>

            {/* Week header (week scale only) */}
            {scale === "week" && (
              <div className="flex border-b text-[10px] text-muted-foreground" style={{ height: 22 }}>
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

            {/* Project rows */}
            {projects.map((p) => {
              const { start, end } = shiftedDates(p);
              const rawStart = weeksBetween(timelineStart, startOfWeek(start));
              const rawEnd = rawStart + weeksBetween(startOfWeek(start), startOfWeek(end)) + 1;
              const startIdx = Math.max(rawStart, 0);
              const span = Math.min(rawEnd, weekCount) - startIdx;
              const isDragging = drag?.projectId === p.id;

              return (
                <div
                  key={p.id}
                  className="relative border-b last:border-b-0"
                  style={{
                    height: ROW_H,
                    backgroundImage:
                      scale === "week"
                        ? `repeating-linear-gradient(to right, transparent 0 ${pxPerWeek - 1}px, hsl(var(--border) / 0.4) ${pxPerWeek - 1}px ${pxPerWeek}px)`
                        : undefined,
                  }}
                >
                  {span > 0 && (
                    <div
                      className={`group absolute flex items-center rounded-md text-xs font-medium text-white shadow-sm ${
                        isDragging
                          ? "z-10 cursor-grabbing shadow-md ring-2 ring-ring"
                          : "cursor-grab transition-[left,width] duration-200 ease-out hover:shadow-md"
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
                        style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
                        onPointerDown={(e) => beginDrag(e, p, "start")}
                      />
                      {span * pxPerWeek > 60 && (
                        <span className="truncate px-2.5">{p.name}</span>
                      )}
                      <div
                        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
                        onPointerDown={(e) => beginDrag(e, p, "end")}
                      />
                      {isDragging && (
                        <div className="absolute -top-7 left-0 z-20 whitespace-nowrap rounded-md border bg-popover px-2 py-0.5 text-[11px] font-normal text-popover-foreground shadow-md">
                          {toISO(start)} → {toISO(end)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Today line */}
            {todayOffset >= 0 && todayOffset <= totalChartW && (
              <div
                className="pointer-events-none absolute top-0 z-10"
                style={{ left: todayOffset, height: "100%" }}
              >
                <div className="absolute bottom-0 top-0 w-[2px] bg-red-500" />
                <div className="absolute -left-[22px] top-0.5 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                  Today
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProjectProfile projectId={profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </div>
  );
}
