"use client";

import { AlertTriangle } from "lucide-react";
import type { Forecast } from "@/lib/forecast";
import { formatWeek, parseLocalDate } from "@/lib/planner";

// Colour a cell by net = supply - demand (in FTE).
function cellStyle(supply: number, demand: number): { bg: string; fg: string } {
  const net = supply - demand;
  if (demand === 0 && supply === 0) return { bg: "transparent", fg: "var(--muted-foreground)" };
  if (net < -0.05) {
    // deficit → red, deeper with larger shortfall
    const t = Math.min(1, -net / 2);
    return { bg: `rgba(220,38,38,${0.18 + t * 0.55})`, fg: net < -0.9 ? "#fff" : "#7f1d1d" };
  }
  if (net > 0.05) {
    const t = Math.min(1, net / 2);
    return { bg: `rgba(5,150,105,${0.12 + t * 0.4})`, fg: "#064e3b" };
  }
  return { bg: "rgba(245,158,11,0.18)", fg: "#78350f" }; // balanced
}

export function ForecastHeatmap({ forecast }: { forecast: Forecast }) {
  const { weeks, roleRows } = forecast;
  const activeRows = roleRows.filter((r) =>
    r.cells.some((c) => c.demandFte > 0 || c.supplyFte > 0)
  );

  if (activeRows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No demand or supply in this window. Define project requirements below.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-2 py-1 text-left text-xs font-medium">
              Role
            </th>
            {weeks.map((w) => (
              <th key={w} className="min-w-[40px] px-1 text-center text-[10px] font-normal text-muted-foreground">
                {formatWeek(parseLocalDate(w))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row) => (
            <tr key={row.role}>
              <td className="sticky left-0 z-10 bg-background py-1 pr-2 text-xs">
                <div className="flex items-center gap-1 font-medium">
                  {row.role}
                  {row.hasNoResources && (
                    <span title="No resources in this role" className="text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </td>
              {row.cells.map((c, i) => {
                const { bg, fg } = cellStyle(c.supplyFte, c.demandFte);
                const net = c.supplyFte - c.demandFte;
                return (
                  <td
                    key={i}
                    className="rounded text-center text-[10px] tabular-nums"
                    style={{ backgroundColor: bg, color: fg, height: 26 }}
                    title={`${row.role} · wk ${weeks[i]}: supply ${c.supplyFte.toFixed(1)} FTE, demand ${c.demandFte.toFixed(1)} FTE${net < -0.05 ? ` → short ${(-net).toFixed(1)}` : ""}`}
                  >
                    {c.demandFte > 0 || c.supplyFte > 0 ? (net >= 0 ? `+${net.toFixed(1)}` : net.toFixed(1)) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ background: "rgba(220,38,38,0.6)" }} /> deficit (short on this role)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ background: "rgba(245,158,11,0.18)" }} /> balanced</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ background: "rgba(5,150,105,0.4)" }} /> surplus (spare)</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> no resources in role — hire needed</span>
      </div>
    </div>
  );
}
