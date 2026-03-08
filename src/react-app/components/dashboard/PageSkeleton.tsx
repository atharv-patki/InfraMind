import { Skeleton } from "@/react-app/components/ui/skeleton";

export function PageSkeleton({
  cards = 4,
  rows = 3,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={`card-${index}`} className="rounded-2xl border border-border p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={`row-${index}`} className="h-10 w-full" />
        ))}
      </section>
    </div>
  );
}
