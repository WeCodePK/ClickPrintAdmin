"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token, isAdmin, isReady, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;
    if (!token || !isAdmin) {
      if (token && !isAdmin) logout();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isReady, token, isAdmin, router, pathname, logout]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (!token || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Redirecting to login…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
