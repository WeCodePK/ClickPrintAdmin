"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { StatCard } from "@/components/ui/stat-card";
import { TopUp } from "@/lib/types";
import { UsersIcon, ShopIcon, TopupIcon, ShieldIcon, CrownIcon } from "@/components/icons";

interface UserStats {
  users: number;
  admins: number;
  owners: number;
  appUsers: number;
}

interface ShopStats {
  shops: number;
  online: number;
  offline: number;
  disabled: number;
}

interface Job {
  _id: string;
  shop?: { _id: string; name: string };
  [key: string]: unknown;
}

function normalizeStatus(value: unknown): "pending" | "approved" | "declined" {
  if (typeof value !== "string") return "pending";
  const v = value.toLowerCase();
  if (v === "approved" || v === "approve") return "approved";
  if (v === "declined" || v === "decline") return "declined";
  return "pending";
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(val);
}

export default function OverviewPage() {
  const { user, token } = useAuth();
  
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [mostActiveShop, setMostActiveShop] = useState<string>("—");
  const [topups, setTopups] = useState<TopUp[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    setLoading(true);

    Promise.all([
      fetch("/api/stats/users", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/stats/shops", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/jobs", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/topups", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([usersData, shopsData, jobsData, topupsData]) => {
      
      if (usersData?.success && usersData.data) {
        setUserStats(usersData.data as UserStats);
      } else {
        setUserStats({ users: 0, admins: 0, owners: 0, appUsers: 0 });
      }

      if (shopsData?.success && shopsData.data) {
        setShopStats(shopsData.data as ShopStats);
      } else {
        setShopStats({ shops: 0, online: 0, offline: 0, disabled: 0 });
      }

      if (jobsData?.success && Array.isArray(jobsData.data?.jobs)) {
        const jobs = jobsData.data.jobs as Job[];
        const countByShop: Record<string, { name: string; count: number }> = {};
        for (const job of jobs) {
          if (job.shop?._id) {
            if (!countByShop[job.shop._id]) {
              countByShop[job.shop._id] = { name: job.shop.name, count: 0 };
            }
            countByShop[job.shop._id].count++;
          }
        }
        const topShop = Object.values(countByShop).sort((a, b) => b.count - a.count)[0];
        setMostActiveShop(topShop ? `${topShop.name} (${topShop.count})` : "—");
      }

      if (topupsData?.success && topupsData.data?.topups) {
        setTopups(topupsData.data.topups);
      }
      
      setLoading(false);
    }).catch(console.error);

  }, [token]);

  const topupStats = useMemo(() => {
    let pending = 0, approved = 0, declined = 0, approvedAmount = 0;
    topups.forEach(t => {
      const s = normalizeStatus(t.status);
      if (s === "pending") pending++;
      else if (s === "approved") { approved++; approvedAmount += t.amount; }
      else declined++;
    });
    return { total: topups.length, pending, approved, declined, approvedAmount };
  }, [topups]);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={loading ? "—" : userStats?.users || 0} icon={<UsersIcon />} accentColor="accent" />
          <StatCard label="App Users" value={loading ? "—" : userStats?.appUsers || 0} accentColor="credit-wallet" />
          <StatCard label="Admins" value={loading ? "—" : userStats?.admins || 0} icon={<ShieldIcon />} accentColor="danger" />
          <StatCard label="Shop Owners" value={loading ? "—" : userStats?.owners || 0} icon={<CrownIcon />} accentColor="warning" />
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Shops" value={loading ? "—" : shopStats?.shops || 0} icon={<ShopIcon />} accentColor="accent" />
          <StatCard label="Most Active" value={loading ? "—" : (mostActiveShop.includes("(") ? mostActiveShop.split(" (")[0] : mostActiveShop)} accentColor="print-request" />
          <StatCard label="Online" value={loading ? "—" : shopStats?.online || 0} accentColor="accent" />
          <StatCard label="Offline" value={loading ? "—" : shopStats?.offline || 0} accentColor="warning" />
          <StatCard label="Disabled" value={loading ? "—" : shopStats?.disabled || 0} accentColor="danger" />
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
          <StatCard label="Total Topups" value={loading ? "—" : topupStats.total} icon={<TopupIcon />} accentColor="accent" />
          <StatCard label="Pending" value={loading ? "—" : topupStats.pending} accentColor="warning" />
          <StatCard label="Approved (Count)" value={loading ? "—" : topupStats.approved} accentColor="print-request" />
          <StatCard label="Approved Amount" value={loading ? "—" : formatMoney(topupStats.approvedAmount)} accentColor="credit-wallet" />
        </div>
      </section>
    </div>
  );
}
