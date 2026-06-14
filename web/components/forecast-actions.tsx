"use client";

import {
  ArrowRightLeft,
  UserPlus,
  CalendarClock,
  GraduationCap,
  Eye,
  type LucideIcon,
} from "lucide-react";
import type { Project } from "@/lib/planner";

export interface ForecastAction {
  type: "reassign" | "hire" | "delay" | "upskill" | "monitor";
  project: string;
  role: string;
  resource?: string;
  timing?: string;
  urgency: "high" | "medium" | "low";
  detail: string;
}

export interface ForecastPlan {
  summary: string;
  actions: ForecastAction[];
}

const TYPE_META: Record<
  ForecastAction["type"],
  { label: string; icon: LucideIcon; border: string; chip: string; iconColor: string }
> = {
  reassign: { label: "Reassign", icon: ArrowRightLeft, border: "border-l-blue-500", chip: "bg-blue-100 text-blue-700", iconColor: "text-blue-600" },
  hire: { label: "Hire / contract", icon: UserPlus, border: "border-l-red-500", chip: "bg-red-100 text-red-700", iconColor: "text-red-600" },
  delay: { label: "Delay", icon: CalendarClock, border: "border-l-amber-500", chip: "bg-amber-100 text-amber-700", iconColor: "text-amber-600" },
  upskill: { label: "Upskill / borrow", icon: GraduationCap, border: "border-l-violet-500", chip: "bg-violet-100 text-violet-700", iconColor: "text-violet-600" },
  monitor: { label: "Monitor", icon: Eye, border: "border-l-slate-400", chip: "bg-slate-100 text-slate-600", iconColor: "text-slate-500" },
};

const URGENCY_DOT: Record<ForecastAction["urgency"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const urgencyRank = { high: 0, medium: 1, low: 2 };

export function ForecastActions({ plan, projects }: { plan: ForecastPlan; projects: Project[] }) {
  const colorByName = new Map(projects.map((p) => [p.name.toLowerCase(), p.color]));
  const actions = [...(plan.actions ?? [])].sort(
    (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]
  );

  return (
    <div className="space-y-3">
      {plan.summary && (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">{plan.summary}</p>
      )}

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actions recommended.</p>
      ) : (
        <div className="space-y-2">
          {actions.map((a, i) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.monitor;
            const Icon = meta.icon;
            const projColor = colorByName.get(a.project?.toLowerCase() ?? "");
            return (
              <div
                key={i}
                className={`rounded-md border border-l-4 bg-background px-3 py-2 ${meta.border}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconColor}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`rounded px-1.5 py-0 text-[10px] font-semibold uppercase ${meta.chip}`}>
                        {meta.label}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-medium">
                        {projColor && (
                          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: projColor }} />
                        )}
                        {a.project}
                      </span>
                      <span className="text-xs text-muted-foreground">· {a.role}</span>
                      {a.resource && (
                        <span className="rounded-full bg-blue-50 px-2 py-0 text-[11px] text-blue-700">
                          {a.resource}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${URGENCY_DOT[a.urgency]}`} />
                        {a.urgency}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
                    {a.timing && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">⏱ {a.timing}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
