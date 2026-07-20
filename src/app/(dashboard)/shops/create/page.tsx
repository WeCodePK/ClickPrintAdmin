import { ShopForm } from "@/components/shop-form";

export default function CreateShopPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Shops
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Create shop
        </h1>
        <p className="mt-2 text-sm text-muted">
          Register a new location with address, timings, and contact details.
        </p>
      </header>

      <ShopForm />
    </div>
  );
}
