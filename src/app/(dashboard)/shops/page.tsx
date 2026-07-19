import { ShopsList } from "@/components/shops-list";

export default function ShopsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Shops
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          All shops
        </h1>
        <p className="mt-2 mb-10 text-sm text-muted">
          Browse every registered print location and its live status.
        </p>
      </header>

      <ShopsList />
    </div>
  );
}
