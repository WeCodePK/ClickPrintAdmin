import { Suspense } from "react";
import { JobsPanel } from "@/components/jobs-panel";

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Jobs & History
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Print jobs
        </h1>
        <p className="mt-2 text-sm text-muted">
          Manage print jobs and view job history.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            Loading jobs…
          </div>
        }
      >
        <JobsPanel />
      </Suspense>
    </div>
  );
}
