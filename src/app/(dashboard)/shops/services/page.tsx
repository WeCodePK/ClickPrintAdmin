import { ServicesPanel } from "@/components/services-panel";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Shops
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Services
        </h1>
        <p className="mt-2 mb-10 text-sm text-muted">
          Manage the priced print options each shop offers and the printers that fulfil them.
        </p>
      </header>

      <ServicesPanel />
    </div>
  );
}
