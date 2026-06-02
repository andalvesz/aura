import { cn } from "@/utils/cn";

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className
      )}
    />
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-[72px]" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
