"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { StatCard } from "@/components/ui/stat-card";
import { DEMO_METRICS } from "@/lib/demo-data";
import { Shop, TopUp } from "@/lib/types";
import { UsersIcon, ShopIcon, TopupIcon } from "@/components/icons";

export default function OverviewPage() {
  const { user, token } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  
  useEffect(() => {
    if (!token) return;
    
    // Fetch Shops
    fetch("/api/shops", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.shops) setShops(data.data.shops);
      }).catch(console.error);

    // Fetch Topups
    fetch("/api/topups", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.topups) setTopups(data.data.topups);
      }).catch(console.error);
  }, [token]);

  const shopStats = {
    total: shops.length,
    online: shops.filter(s => s.isOnline && !s.isDisabled).length
  };

  const topupStats = {
    total: topups.length,
    pending: topups.filter(t => t.status === "pending" || t.status === "Pending").length,
    approved: topups.filter(t => t.status === "approved" || t.status === "Approved" || t.status === "approve").length,
    declined: topups.filter(t => t.status === "declined" || t.status === "Declined" || t.status === "decline").length,
    approvedAmount: topups.reduce((acc, t) => {
      const st = (t.status as string).toLowerCase();
      if (st === "approved" || st === "approve") return acc + (Number(t.amount) || 0);
      return acc;
    }, 0)
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Dashboard</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Overview
        </h1>
        <p className="mt-2 text-muted">
          Welcome back, {user?.name || "Admin"}. Here is what's happening today.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold">Users Summary</h2>
          </div>
          <Link href="/users" className="text-sm text-accent hover:underline font-medium">View all users →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Users" value={DEMO_METRICS.totalUsers} isDemo accentColor="accent" />
          <StatCard label="Total Prints" value={DEMO_METRICS.totalPrints} isDemo accentColor="print-request" />
          <StatCard label="Avg Prints / User" value={DEMO_METRICS.avgPrintsPerUser} isDemo accentColor="credit-wallet" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShopIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold">Shops Summary</h2>
          </div>
          <Link href="/shops" className="text-sm text-accent hover:underline font-medium">Manage shops →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Shops" value={shopStats.total} accentColor="accent" />
          <StatCard label="Online Shops" value={shopStats.online} accentColor="warning" />
          <StatCard label="Most Active" value={DEMO_METRICS.mostActiveShopName} isDemo accentColor="print-request" />
          <StatCard label="Added (30d)" value={DEMO_METRICS.shopsAddedLast30Days} isDemo accentColor="credit-wallet" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TopupIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold">Top-ups Summary</h2>
          </div>
          <Link href="/topups" className="text-sm text-accent hover:underline font-medium">Review top-ups →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Requests" value={topupStats.total} accentColor="accent" />
          <StatCard label="Pending" value={topupStats.pending} accentColor="warning" />
          <StatCard label="Approved Amount" value={`${topupStats.approvedAmount.toLocaleString()} PKR`} accentColor="credit-wallet" />
          <div className="bg-surface rounded-xl border border-border p-4 flex flex-col justify-center">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-muted">Approved</span>
              <span className="font-semibold text-accent">{topupStats.approved}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Declined</span>
              <span className="font-semibold text-danger">{topupStats.declined}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
