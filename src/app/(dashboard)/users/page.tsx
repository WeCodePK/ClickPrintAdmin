import { UsersPanel } from "@/components/users-panel";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Users
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          All users
        </h1>
        <p className="mt-2 mb-10 text-sm text-muted">
          Browse every platform user, their balance, and print activity.
        </p>
      </header>

      <UsersPanel tab="users" />
    </div>
  );
}
