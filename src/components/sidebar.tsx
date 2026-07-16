"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardIcon, UsersIcon, ShopIcon, TopupIcon, MenuIcon } from "@/components/icons";

function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  const shopsOpenDefault = pathname.startsWith("/shops");
  const [shopsOpen, setShopsOpen] = useState(shopsOpenDefault);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (shopsOpenDefault) setShopsOpen(true);
  }, [shopsOpenDefault]);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-nav-active/10 text-nav-active"
        : "text-nav-inactive hover:bg-white/5 hover:text-white"
    } ${collapsed ? "justify-center px-0" : ""}`;

  const groupBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-nav-active/10 text-nav-active"
        : "text-nav-inactive hover:bg-white/5 hover:text-white"
    } ${collapsed ? "justify-center px-0" : ""}`;

  const subLinkClass = (active: boolean) =>
    `block rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? "text-nav-active font-medium"
        : "text-sidebar-muted hover:text-white"
    }`;

  return (
    <aside className={`flex flex-col justify-between border-b border-white/10 bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto ${collapsed ? "lg:w-20 w-full" : "lg:w-64 w-full"}`}>
      <div>
        <div className={`border-b border-white/10 flex items-center ${collapsed ? "justify-center py-6 px-2" : "px-6 py-6 justify-between"}`}>
          {!collapsed && (
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-white">
                ClickPrint
              </p>
              <p className="mt-1 text-sm text-sidebar-muted">Admin console</p>
              <p className="mt-4 truncate text-xs font-medium text-white/80 bg-white/10 rounded px-2 py-1 inline-block max-w-full">
                {user?.name || user?.number}
                {isAdmin ? " · Admin" : ""}
              </p>
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="p-2 text-sidebar-muted hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-2 px-3 py-6 lg:px-4">
          <Link
            href="/"
            className={linkClass(pathname === "/")}
            title={collapsed ? "Dashboard" : undefined}
          >
            <div className="flex items-center gap-3">
              {!collapsed && <span className="text-xs opacity-50">1.</span>}
              <DashboardIcon className="w-5 h-5" />
              {!collapsed && <span>Dashboard</span>}
            </div>
          </Link>

          <Link
            href="/users"
            className={linkClass(pathname.startsWith("/users"))}
            title={collapsed ? "Users" : undefined}
          >
            <div className="flex items-center gap-3">
              {!collapsed && <span className="text-xs opacity-50">2.</span>}
              <UsersIcon className="w-5 h-5" />
              {!collapsed && <span>Users</span>}
            </div>
          </Link>

          <div>
            <button
              type="button"
              onClick={() => {
                if (collapsed) setCollapsed(false);
                setShopsOpen((v) => !v);
              }}
              className={groupBtn(pathname.startsWith("/shops"))}
              aria-expanded={shopsOpen}
              title={collapsed ? "Shops" : undefined}
            >
              <div className="flex items-center gap-3">
                {!collapsed && <span className="text-xs opacity-50">3.</span>}
                <ShopIcon className="w-5 h-5" />
                {!collapsed && <span>Shops</span>}
              </div>
              {!collapsed && (
                <span
                  className={`text-[10px] transition-transform duration-200 opacity-50 ${
                    shopsOpen ? "rotate-90" : ""
                  }`}
                >
                  ▸
                </span>
              )}
            </button>
            {shopsOpen && !collapsed ? (
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

          <Link
            href="/topups"
            className={linkClass(pathname.startsWith("/topups"))}
            title={collapsed ? "Top-ups" : undefined}
          >
            <div className="flex items-center gap-3">
              {!collapsed && <span className="text-xs opacity-50">4.</span>}
              <TopupIcon className="w-5 h-5" />
              {!collapsed && <span>Top-ups</span>}
            </div>
          </Link>
        </nav>
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className={`w-full rounded-lg border border-white/10 py-2 text-sm text-sidebar-muted transition hover:bg-white/5 hover:text-white flex items-center justify-center gap-2 ${collapsed ? "px-0" : "px-3"}`}
          title={collapsed ? "Log out" : undefined}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          ) : "Log out"}
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
