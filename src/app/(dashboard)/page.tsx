"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { StatCard } from "@/components/ui/stat-card";
import { TopUp, AdminUser, Shop, Job, Draft } from "@/lib/types";
import { UsersIcon, ShopIcon, TopupIcon, ShieldIcon, CrownIcon, DocumentIcon, PrinterIcon } from "@/components/icons";

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

interface DraftStats {
  drafts: number;
  ready: number;
  complete: number;
  incomplete: number;
}

interface JobStats {
  jobs: number;
  printing: number;
  queued: number;
  submitted: number;
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  return value.toLowerCase();
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(val);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export default function OverviewPage() {
  const { user, token } = useAuth();
  
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [draftStats, setDraftStats] = useState<DraftStats | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [shopsList, setShopsList] = useState<Shop[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [draftsList, setDraftsList] = useState<Draft[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  
  const [mostActiveShop, setMostActiveShop] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    Promise.all([
      fetch("/api/stats/users", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/stats/shops", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/stats/drafts", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/stats/jobs", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/shops", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/topups", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/drafts", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch("/api/jobs", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([usersStatsData, shopsStatsData, draftsStatsData, jobsStatsData, usersData, shopsData, topupsData, draftsData, jobsData]) => {
      
      // Stats
      if (usersStatsData?.success && usersStatsData.data) setUserStats(usersStatsData.data.stats || usersStatsData.data);
      else setUserStats({ users: 0, admins: 0, owners: 0, appUsers: 0 });

      if (shopsStatsData?.success && shopsStatsData.data) setShopStats(shopsStatsData.data.stats || shopsStatsData.data);
      else setShopStats({ shops: 0, online: 0, offline: 0, disabled: 0 });

      if (draftsStatsData?.success && draftsStatsData.data) setDraftStats(draftsStatsData.data.stats);
      else setDraftStats({ drafts: 0, ready: 0, complete: 0, incomplete: 0 });

      if (jobsStatsData?.success && jobsStatsData.data) setJobStats(jobsStatsData.data.stats);
      else setJobStats({ jobs: 0, printing: 0, queued: 0, submitted: 0 });

      // Lists
      if (usersData?.success && usersData.data?.users) setUsersList(usersData.data.users);
      if (shopsData?.success && shopsData.data?.shops) setShopsList(shopsData.data.shops);
      if (topupsData?.success && topupsData.data?.topups) setTopups(topupsData.data.topups);
      if (draftsData?.success && draftsData.data?.drafts) setDraftsList(draftsData.data.drafts);
      
      let jobsArray: Job[] = [];
      if (jobsData?.success && jobsData.data?.jobs) jobsArray = jobsData.data.jobs;
      setJobsList(jobsArray);

      // Most active shop
      const countByShop: Record<string, { name: string; count: number }> = {};
      for (const job of jobsArray) {
        if (typeof job.shop === 'object' && job.shop?._id) {
          if (!countByShop[job.shop._id]) {
            countByShop[job.shop._id] = { name: (job.shop as any).name || 'Unknown', count: 0 };
          }
          countByShop[job.shop._id].count++;
        }
      }
      const topShop = Object.values(countByShop).sort((a, b) => b.count - a.count)[0];
      setMostActiveShop(topShop ? `${topShop.name} (${topShop.count})` : "—");
      
      setLoading(false);
    }).catch(console.error);

  }, [token]);

  const topupStats = useMemo(() => {
    let pending = 0, approved = 0, declined = 0, approvedAmount = 0;
    topups.forEach(t => {
      const s = normalizeStatus(t.status);
      if (s === "pending") pending++;
      else if (s === "approved" || s === "approve") { approved++; approvedAmount += t.amount; }
      else declined++;
    });
    return { total: topups.length, pending, approved, declined, approvedAmount };
  }, [topups]);

  const previewUsers = usersList.slice(0, 5);
  const previewShops = shopsList.slice(0, 5);
  const previewTopups = topups.slice(0, 5);
  const previewDrafts = draftsList.slice(0, 5);
  const previewJobs = jobsList.slice(0, 5);

  return (
    <div className="space-y-12 pb-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Dashboard</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Overview
        </h1>
        <p className="mt-2 text-muted">
          Welcome back, {user?.name || "Admin"}. Here is what's happening today.
        </p>
      </header>

      {/* USERS */}
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
        {!loading && previewUsers.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone Number</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewUsers.map(u => (
                    <tr key={u._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                      <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                      <td className="px-4 py-3 text-muted">{u.number}</td>
                      <td className="px-4 py-3">{u.balance} PKR</td>
                      <td className="px-4 py-3">
                        {u.isDisabled ? (
                          <span className="bg-danger-soft text-danger px-2 py-0.5 rounded text-xs font-medium">Disabled</span>
                        ) : (
                          <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-xs font-medium">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* SHOPS */}
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
        {!loading && previewShops.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Shop Name</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewShops.map(s => (
                    <tr key={s._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted truncate max-w-[200px]">{s.address}</td>
                      <td className="px-4 py-3">
                        {s.isDisabled ? (
                          <span className="bg-danger-soft text-danger px-2 py-0.5 rounded text-xs font-medium">Disabled</span>
                        ) : s.isOnline ? (
                          <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-xs font-medium">Online</span>
                        ) : (
                          <span className="bg-warning-soft text-warning px-2 py-0.5 rounded text-xs font-medium">Offline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* TOPUPS */}
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
          <StatCard label="Approved" value={loading ? "—" : topupStats.approved} accentColor="print-request" />
          <StatCard label="Approved Amount" value={loading ? "—" : formatMoney(topupStats.approvedAmount)} accentColor="credit-wallet" />
        </div>
        {!loading && previewTopups.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTopups.map(t => (
                    <tr key={t._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                      <td className="px-4 py-3 text-muted">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{formatMoney(t.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${
                           normalizeStatus(t.status) === "approved" ? "bg-print-request-soft text-print-request" : 
                           normalizeStatus(t.status) === "declined" ? "bg-danger-soft text-danger" : 
                           "bg-warning-soft text-warning"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* DRAFTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold">Drafts Summary</h2>
          </div>
          <Link href="/drafts" className="text-sm text-accent hover:underline font-medium">Manage drafts →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Drafts" value={loading ? "—" : draftStats?.drafts || 0} icon={<DocumentIcon />} accentColor="accent" />
          <StatCard label="Ready" value={loading ? "—" : draftStats?.ready || 0} accentColor="print-request" />
          <StatCard label="Incomplete" value={loading ? "—" : draftStats?.incomplete || 0} accentColor="warning" />
          <StatCard label="Complete" value={loading ? "—" : draftStats?.complete || 0} accentColor="accent" />
        </div>
        {!loading && previewDrafts.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewDrafts.map(d => (
                    <tr key={d._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                      <td className="px-4 py-3 text-muted">{formatDate(d.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${
                           d.status === "ready" ? "bg-print-request-soft text-print-request" : 
                           d.status === "incomplete" ? "bg-warning-soft text-warning" : 
                           "bg-surface-muted text-muted"
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* JOBS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PrinterIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold">Jobs Summary</h2>
          </div>
          <Link href="/jobs" className="text-sm text-accent hover:underline font-medium">View jobs →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Jobs" value={loading ? "—" : jobStats?.jobs || 0} icon={<PrinterIcon />} accentColor="accent" />
          <StatCard label="Printing" value={loading ? "—" : jobStats?.printing || 0} accentColor="accent" />
          <StatCard label="Queued" value={loading ? "—" : jobStats?.queued || 0} accentColor="warning" />
          <StatCard label="Submitted" value={loading ? "—" : jobStats?.submitted || 0} accentColor="neutral" />
        </div>
        {!loading && previewJobs.length > 0 && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-muted/50 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewJobs.map(j => (
                    <tr key={j._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                      <td className="px-4 py-3 text-muted">{formatDate(j.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{j.cost ? formatMoney(j.cost) : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${
                           j.status === "completed" ? "bg-print-request-soft text-print-request" : 
                           j.status === "cancelled" || j.status === "failed" ? "bg-danger-soft text-danger" :
                           j.status === "printing" ? "bg-accent-soft text-accent" : 
                           "bg-warning-soft text-warning"
                        }`}>
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
