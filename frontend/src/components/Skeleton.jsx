export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className}`}
      style={style}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="p-6 rounded-2xl border border-white/5" style={{ backgroundColor: '#111827' }}>
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-9 w-20 mb-4" />
      <Skeleton className="h-1 w-full rounded-full" />
    </div>
  )
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="p-6 rounded-2xl border border-white/5" style={{ backgroundColor: '#111827' }}>
      <Skeleton className="h-5 w-40 mb-1" />
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="rounded-xl" style={{ height, width: '100%' }} />
    </div>
  )
}

export function SkeletonTable({ rows = 8 }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#111827' }}>
      <div className="p-4 border-b border-white/5 flex flex-wrap gap-3">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center py-2">
            <Skeleton className="h-4 w-28 flex-shrink-0" />
            <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[300px]" />
            <Skeleton className="h-4 w-16 flex-shrink-0" />
            <Skeleton className="h-4 w-20 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
