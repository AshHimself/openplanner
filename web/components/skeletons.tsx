import { Skeleton } from "@/components/ui/skeleton";

// A grid/chart placeholder — used as the Suspense fallback for lazily-loaded
// visualisations (heatmap, Gantt) and for data-loading states.
export function ChartSkeleton({ rows = 5, cols = 12 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-28 shrink-0" />
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-1.5">
          <Skeleton className="h-6 w-28 shrink-0" />
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" style={{ opacity: 1 - (c / cols) * 0.4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Skeleton className="h-5 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-md border px-3 py-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

// Generic page skeleton — header + stat row + a table/chart block. Used as the
// route-level fallback for the whole app and for full-page data loads.
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <StatCardsSkeleton />
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-3 h-4 w-56" />
        <ChartSkeleton rows={6} />
      </div>
    </div>
  );
}

// Forecast data-area skeleton (header + stat row stay live; this fills the charts).
export function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-3 h-4 w-64" />
        <ChartSkeleton rows={4} />
      </div>
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-3 h-4 w-64" />
        <ChartSkeleton rows={5} />
      </div>
    </div>
  );
}
