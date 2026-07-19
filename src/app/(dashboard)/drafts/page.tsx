import { Suspense } from "react";
import { DraftsPanel } from "@/components/drafts-panel";

export default function DraftsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Drafts
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Print drafts
        </h1>
        <p className="mt-2 text-sm text-muted">
          View and manage user print drafts.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            Loading drafts…
          </div>
        }
      >
        <DraftsPanel />
      </Suspense>
    </div>
  );
}
