# OpenPlanner

Resource planning across multiple projects — an early-stage rebuild of the ideas behind Planview Portfolios.

## What it does (v1)

- **Capacity plan** — 12-week heatmap of allocated hours vs. capacity per person, with over-allocation highlighting and per-project breakdowns
- **Projects** — portfolio list with status, priority, timeline, staffing (FTE), budget, and forecast cost (over/under budget)
- **Resources** — people with roles, teams, weekly capacity, and day rates
- **Allocations** — assign a resource to a project for a span of weeks, with live cost-vs-budget impact as you edit
- **Dashboard** — utilization, over-allocation alerts, and budget health across the portfolio

Data is kept in browser localStorage (falls back to in-memory). No backend yet.

## Stack

React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui, bundled to a single self-contained HTML file with Parcel.

## Develop

```bash
cd resource-planner
pnpm install
pnpm dev
```

## Build the single-file artifact

The app bundles to `resource-planner/bundle.html` — one self-contained HTML file with everything inlined. Open it directly in a browser, no server needed.
