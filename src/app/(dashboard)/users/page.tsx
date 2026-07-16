import { UsersPanel } from "@/components/users-panel";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Users
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          User Management
        </h1>
        <p className="mt-2 text-sm text-muted">
          View and manage platform users, their print statistics, and administrative roles.
        </p>
      </header>

      <UsersPanel />
    </div>
  );
}
