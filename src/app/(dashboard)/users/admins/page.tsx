import { UsersPanel } from "@/components/users-panel";

export default function AdminsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Users
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Admins
        </h1>
        <p className="mt-2 mb-10 text-sm text-muted">
          Manage who holds console-wide administrative access.
        </p>
      </header>

      <UsersPanel tab="admins" />
    </div>
  );
}
