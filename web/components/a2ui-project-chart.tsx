"use client";

import { z } from "zod";
import { createComponentImplementation, basicCatalog } from "@a2ui/react/v0_9";
import { Catalog, CommonSchemas } from "@a2ui/web_core/v0_9";
import {
  usePlanner,
  useTimesheets,
  projectForecast,
  projectActualCost,
  formatCurrency,
} from "@/lib/planner";

// Custom A2UI component: a compact budget-health bar for a single project.
// The model only supplies a projectId — the component looks up live planner
// data and draws the graphic itself, so the model never has to invent numbers.
const ProjectChartApi = {
  name: "ProjectChart",
  schema: z.object({
    projectId: CommonSchemas.DynamicString,
  }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ProjectChartRender = ({ props }: { props: any }) => {
  const { projects, resources, allocations } = usePlanner();
  const { timesheets } = useTimesheets();

  const projectId = String(props.projectId ?? "");
  const p = projects.find((x) => x.id === projectId);

  if (!p) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        No chart — project not found.
      </div>
    );
  }

  const budget = p.budget ?? 0;
  const forecast = projectForecast(p.id, allocations, resources);
  const actual = projectActualCost(p.id, timesheets, resources);

  // Scale bars against the larger of budget / forecast / actual so nothing clips.
  const scaleMax = Math.max(budget, forecast, actual, 1);
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;

  const overBudget = budget > 0 && actual > budget;
  const forecastOver = budget > 0 && forecast > budget;

  return (
    <div className="space-y-2 rounded-md border bg-background px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          Budget health
        </span>
        {budget > 0 && (
          <span
            className={`text-[10px] font-semibold ${
              overBudget ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {overBudget ? "OVER BUDGET" : "On track"}
          </span>
        )}
      </div>

      {/* Budget track with actual + forecast overlays */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        {/* Actual spend */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: pct(actual),
            backgroundColor: overBudget ? "#dc2626" : "#059669",
          }}
          title={`Actual: ${formatCurrency(actual)}`}
        />
        {/* Forecast marker */}
        {forecast > 0 && (
          <div
            className="absolute top-0 h-full w-[2px] bg-foreground/60"
            style={{ left: pct(forecast) }}
            title={`Forecast: ${formatCurrency(forecast)}`}
          />
        )}
        {/* Budget marker (only if budget < scaleMax, i.e. something exceeds it) */}
        {budget > 0 && budget < scaleMax && (
          <div
            className="absolute top-0 h-full w-[2px] bg-red-500"
            style={{ left: pct(budget) }}
            title={`Budget: ${formatCurrency(budget)}`}
          />
        )}
      </div>

      {/* Legend / numbers */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: overBudget ? "#dc2626" : "#059669" }} />
          Actual {formatCurrency(actual)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-[2px] bg-foreground/60" />
          Forecast {formatCurrency(forecast)}
        </span>
        {budget > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-[2px] bg-red-500" />
            Budget {formatCurrency(budget)}
          </span>
        )}
      </div>

      {forecastOver && !overBudget && (
        <p className="text-[10px] text-amber-600">
          Forecast exceeds budget by {formatCurrency(forecast - budget)}.
        </p>
      )}
    </div>
  );
};

export const ProjectChart = createComponentImplementation(ProjectChartApi, ProjectChartRender);

// Catalog combining all basic components + our custom ProjectChart, reusing the
// basic catalog id so the model's createSurface.catalogId still resolves.
export const chatCatalog = new Catalog(
  basicCatalog.id,
  [...basicCatalog.components.values(), ProjectChart],
  [...basicCatalog.functions.values()],
  basicCatalog.themeSchema
);
