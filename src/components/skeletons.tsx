"use client";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden">
      <div className="border-b border-border-default px-4 py-3 flex gap-4">
        {[40, 120, 80, 70, 90, 60, 80, 70].map((w, i) => (
          <div key={i} className="h-3 rounded bg-surface-3 shimmer-bg" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle last:border-b-0"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="h-3 w-6 rounded bg-surface-3 shimmer-bg" />
          <div className="h-3 rounded bg-surface-3 shimmer-bg" style={{ width: 100 + Math.random() * 80 }} />
          <div className="h-3 w-16 rounded bg-surface-3 shimmer-bg" />
          <div className="h-4 w-14 rounded-md bg-surface-3 shimmer-bg" />
          <div className="h-3 w-20 rounded bg-surface-3 shimmer-bg" />
          <div className="h-3 w-8 rounded bg-surface-3 shimmer-bg" />
          <div className="h-3 w-10 rounded bg-surface-3 shimmer-bg" />
          <div className="h-3 w-8 rounded bg-surface-3 shimmer-bg" />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border-default bg-surface-1 p-4 space-y-2">
          <div className="h-3 w-16 rounded bg-surface-3 shimmer-bg" />
          <div className="h-7 w-12 rounded bg-surface-3 shimmer-bg" />
        </div>
      ))}
    </div>
  );
}

export function ScanHistorySkeleton() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-1 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-subtle">
        <div className="h-3 w-24 rounded bg-surface-3 shimmer-bg" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-4 py-2.5 border-b border-border-subtle last:border-b-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-surface-3 shimmer-bg" />
            <div className="h-3 w-20 rounded bg-surface-3 shimmer-bg" />
          </div>
          <div className="h-3 w-16 rounded bg-surface-3 shimmer-bg" />
        </div>
      ))}
    </div>
  );
}

export function OrgStatsSkeleton() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-1 p-5 space-y-4">
      <div className="h-3 w-32 rounded bg-surface-3 shimmer-bg" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-surface-3 shimmer-bg" />
            <div className="h-5 w-8 rounded bg-surface-3 shimmer-bg" />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-full rounded bg-surface-3 shimmer-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}
