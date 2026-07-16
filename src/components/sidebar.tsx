"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardIcon, UsersIcon, ShopIcon, TopupIcon } from "@/components/icons";

function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  const shopsOpenDefault = pathname.startsWith("/shops");
  const topupsOpenDefault = pathname.startsWith("/topups");
  const [shopsOpen, setShopsOpen] = useState(shopsOpenDefault);
  const [topupsOpen, setTopupsOpen] = useState(topupsOpenDefault);
  const [topupsHovered, setTopupsHovered] = useState(false);

  useEffect(() => {
    if (shopsOpenDefault) setShopsOpen(true);
    if (topupsOpenDefault) setTopupsOpen(true);
  }, [shopsOpenDefault, topupsOpenDefault]);

  const topupStatus = searchParams.get("status");
  const pendingActive =
    pathname === "/topups" && (!topupStatus || topupStatus === "pending");
  const allTopupsActive = pathname === "/topups" && topupStatus === "all";

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-nav-active/10 text-nav-active"
        : "text-nav-inactive hover:bg-white/5 hover:text-white"
    }`;

  const groupBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-nav-active/10 text-nav-active"
        : "text-nav-inactive hover:bg-white/5 hover:text-white"
    }`;

  const subLinkClass = (active: boolean) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? "text-nav-active font-medium"
        : "text-sidebar-muted hover:text-white"
    }`;

  return (
    <aside className="flex w-full flex-col justify-between border-b border-white/10 bg-sidebar text-sidebar-foreground lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div>
        <div className="border-b border-white/10 px-6 py-6">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-white">
            ClickPrint
          </p>
          <p className="mt-1 text-sm text-sidebar-muted">Admin console</p>
          <p className="mt-4 truncate text-xs font-medium text-white/80 bg-white/10 rounded px-2 py-1 inline-block">
            {user?.name || user?.number}
            {isAdmin ? " · Admin" : ""}
          </p>
        </div>

        <nav className="flex flex-col gap-2 px-3 py-6 lg:px-4">
          <Link
            href="/"
            className={linkClass(pathname === "/")}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-50">1.</span>
              <DashboardIcon className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
          </Link>

          <Link
            href="/users"
            className={linkClass(pathname.startsWith("/users"))}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-50">2.</span>
              <UsersIcon className="w-5 h-5" />
              <span>Users</span>
            </div>
          </Link>

          <div>
            <button
              type="button"
              onClick={() => setShopsOpen((v) => !v)}
              className={groupBtn(pathname.startsWith("/shops"))}
              aria-expanded={shopsOpen}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs opacity-50">3.</span>
                <ShopIcon className="w-5 h-5" />
                <span>Shops</span>
              </div>
              <span
                className={`text-[10px] transition-transform duration-200 opacity-50 ${
                  shopsOpen ? "rotate-90" : ""
                }`}
              >
                ▸
              </span>
            </button>
            {shopsOpen ? (
              <div className="mt-1 ml-9 space-y-1 border-l border-white/10 pl-2">
                <Link
                  href="/shops"
                  className={subLinkClass(pathname === "/shops")}
                >
                  All shops
                </Link>
                <Link
                  href="/shops/create"
                  className={subLinkClass(pathname === "/shops/create")}
                >
                  Create shop
                </Link>
              </div>
            ) : null}
          </div>

          <div
            onMouseEnter={() => setTopupsHovered(true)}
            onMouseLeave={() => setTopupsHovered(false)}
          >
            <button
              type="button"
              onClick={() => setTopupsOpen((v) => !v)}
              className={groupBtn(pathname.startsWith("/topups"))}
              aria-expanded={topupsOpen || topupsHovered}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs opacity-50">4.</span>
                <TopupIcon className="w-5 h-5" />
                <span>Top-ups</span>
              </div>
              <span
                className={`text-[10px] transition-transform duration-200 opacity-50 ${
                  topupsOpen || topupsHovered ? "rotate-90" : ""
                }`}
              >
                ▸
              </span>
            </button>
            {topupsOpen || topupsHovered ? (
              <div className="mt-1 ml-9 space-y-1 border-l border-white/10 pl-2">
                <Link href="/topups" className={subLinkClass(pendingActive)}>
                  Pending
                </Link>
                <Link
                  href="/topups?status=all"
                  className={subLinkClass(allTopupsActive)}
                >
                  All requests
                </Link>
              </div>
            ) : null}
          </div>
        </nav>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-sidebar-muted transition hover:bg-white/5 hover:text-white flex items-center justify-center gap-2"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="w-full bg-sidebar lg:min-h-screen lg:w-64" />
      }
    >
      <SidebarNav />
    </Suspense>
  );
}
