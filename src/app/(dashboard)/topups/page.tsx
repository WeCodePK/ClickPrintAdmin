import { Suspense } from "react";
import { TopUpsPanel } from "@/components/topups-panel";

export default function TopUpsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Top-ups
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Wallet top-ups
        </h1>
        <p className="mt-2 text-sm text-muted">
          Approve or decline shop wallet funding requests.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            Loading top-ups…
          </div>
        }
      >
        <TopUpsPanel />
      </Suspense>
    </div>
  );
}
