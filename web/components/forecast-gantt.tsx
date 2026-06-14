"use client";

import { LogOut } from "lucide-react";
import type { Forecast } from "@/lib/forecast";
import type { Project, Resource } from "@/lib/planner";
import { formatWeek, formatDate, parseLocalDate, addWeeks, STANDARD_WEEK_HOURS } from "@/lib/planner";

export function ForecastGantt({
  forecast,
  projects,
  resources,
}: {
  forecast: Forecast;
  projects: Project[];
  resources: Resource[];
}) {
  const { weeks, resourceRows } = forecast;
  const projectColor = new Map(projects.map((p) => [p.id, p.color]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const endDateById = new Map(resources.map((r) => [r.id, r.endDate ?? null]));
  const weekDates = weeks.map((w) => parseLocalDate(w));

  // Only show resources that have any activity (current or proposed) in window.
  const rows = resourceRows.filter((r) =>
    r.cells.some((c) => c.allocatedHours > 0 || c.proposedFte > 0)
  );

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No resources are active in this window.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-2 py-1 text-left text-xs font-medium">
              Resource
            </th>
            {weeks.map((w) => (
              <th key={w} className="min-w-[40px] px-1 text-center text-[10px] font-normal text-muted-foreground">
                {formatWeek(parseLocalDate(w))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const endIso = endDateById.get(row.resourceId);
            const end = endIso ? parseLocalDate(endIso) : null;
            const rollOffIdx = end
              ? weekDates.findIndex((w) => end >= w && end < addWeeks(w, 1))
              : -1;
            return (
            <tr key={row.resourceId}>
              <td className="sticky left-0 z-10 bg-background py-1 pr-2">
                <div className="text-xs font-medium">{row.name}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {row.role}
                  {end && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700">
                      <LogOut className="h-2 w-2" />
                      {formatDate(endIso!)}
                    </span>
                  )}
                </div>
              </td>
              {row.cells.map((c, i) => {
                const util = row.capacity > 0 ? c.allocatedHours / row.capacity : 0;
                const proposedColor = c.proposedProjectId
                  ? projectColor.get(c.proposedProjectId) ?? "#6366f1"
                  : null;
                const isRollOff = i === rollOffIdx;
                const gone = end !== null && i > rollOffIdx && rollOffIdx >= 0;
                const title =
                  (c.allocatedHours > 0 ? `Booked ${c.allocatedHours}h (${Math.round(util * 100)}%)` : "Free") +
                  (c.proposedFte > 0
                    ? ` · proposed → ${projectName.get(c.proposedProjectId ?? "") ?? "?"} (${c.proposedFte.toFixed(1)} FTE)`
                    : "") +
                  (isRollOff ? ` · rolls off ${formatDate(endIso!)}` : "");
                return (
                  <td
                    key={i}
                    style={{
                      height: 28,
                      ...(gone ? { backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(120,113,108,0.10) 4px, rgba(120,113,108,0.10) 8px)" } : {}),
                    }}
                    className={`relative align-middle ${isRollOff ? "border-r-2 border-r-amber-500" : ""}`}
                    title={title}
                  >
                    {isRollOff && (
                      <LogOut className="absolute right-0 top-0 z-10 h-2.5 w-2.5 text-amber-500" />
                    )}
                    {/* current allocation = solid teal bar by utilisation */}
                    {c.allocatedHours > 0 && (
                      <div
                        className="mx-auto rounded-sm"
                        style={{
                          height: 18,
                          width: `${Math.max(20, Math.min(100, util * 100))}%`,
                          backgroundColor: "#0f766e",
                          opacity: 0.85,
                        }}
                      />
                    )}
                    {/* proposed assignment = dashed ghost bar in project colour */}
                    {c.proposedFte > 0 && (
                      <div
                        className="mx-auto mt-0.5 rounded-sm border border-dashed"
                        style={{
                          height: 14,
                          width: `${Math.max(20, Math.min(100, (c.proposedFte * STANDARD_WEEK_HOURS / Math.max(row.capacity, 1)) * 100))}%`,
                          borderColor: proposedColor ?? "#6366f1",
                          backgroundColor: `${proposedColor ?? "#6366f1"}22`,
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: "#0f766e", opacity: 0.85 }} />
          current booking
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-dashed border-indigo-400 bg-indigo-100" />
          proposed assignment (plan only)
        </span>
        <span className="flex items-center gap-1">
          <LogOut className="h-2.5 w-2.5 text-amber-500" />
          rolls off (end date)
        </span>
      </div>
    </div>
  );
}
