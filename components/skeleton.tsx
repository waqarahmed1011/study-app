import { cx } from "@/components/ui";

function Bar({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

/** Shown instantly while a page's data loads, so taps never feel ignored. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "study" }) {
  if (variant === "study") {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Loading">
        <Bar className="h-3 w-full" />
        <Bar className="h-7 w-3/4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading">
      <Bar className="h-8 w-56" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Bar key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Bar key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
