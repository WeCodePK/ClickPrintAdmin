import { PrintersPanel } from "@/components/printers-panel";

export default function PrintersPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Shops
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Printers
        </h1>
        <p className="mt-2 mb-10 text-sm text-muted">
          Manage the printers registered at each print shop.
        </p>
      </header>

      <PrintersPanel />
    </div>
  );
}
