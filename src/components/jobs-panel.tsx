"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { ListJobsResponse, Job, JobStatsData, ListHistoryResponse, HistoryEntry, HistoryStatsData } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { EyeIcon, TrashIcon, RefreshIcon, CheckIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  return value.toLowerCase();
}

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-warning-soft text-warning",
    queued: "bg-warning-soft text-warning",
    printing: "bg-accent-soft text-accent",
    cancelled: "bg-danger-soft text-danger",
    completed: "bg-print-request-soft text-print-request",
    failed: "bg-danger-soft text-danger",
  };
  const style = styles[status.toLowerCase()] || "bg-surface-muted text-muted";
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function HistoryStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    cancelled: "bg-danger-soft text-danger",
    failed: "bg-danger-soft text-danger",
    completed: "bg-print-request-soft text-print-request",
  };
  const style = styles[status.toLowerCase()] || "bg-surface-muted text-muted";
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function extractJobs(data: ListJobsResponse): Job[] {
  const raw = data.data?.jobs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Job => Boolean(item?._id));
}

function extractHistory(data: ListHistoryResponse): HistoryEntry[] {
  const raw = data.data?.history;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is HistoryEntry => Boolean(item?._id));
}

function createdByLabel(item: Job | HistoryEntry) {
  const by = item.createdBy;
  if (!by) return "—";
  if (typeof by === "string") return by;
  return by.name || by.number || by._id;
}

export function JobsPanel() {
  const { token } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"jobs" | "history">("jobs");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | HistoryEntry | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [jobStats, setJobStats] = useState<JobStatsData["stats"]>({
    jobs: 0,
    printing: 0,
    queued: 0,
    submitted: 0,
  });

  const [historyStats, setHistoryStats] = useState<HistoryStatsData["stats"]>({
    jobs: 0,
    cancelled: 0,
    failed: 0,
    completed: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    status: true,
    createdBy: true,
    cost: true,
    createdAt: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const loadJobStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/stats/jobs", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        console.error("Failed to load job stats");
        return;
      }
      setJobStats(data.data?.stats || {
        jobs: 0,
        printing: 0,
        queued: 0,
        submitted: 0,
      });
    } catch {
      console.error("Network error while loading job stats");
    }
  }, [token]);

  const loadHistoryStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/stats/history", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        console.error("Failed to load history stats");
        return;
      }
      setHistoryStats(data.data?.stats || {
        jobs: 0,
        cancelled: 0,
        failed: 0,
        completed: 0,
      });
    } catch {
      console.error("Network error while loading history stats");
    }
  }, [token]);

  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to load jobs");
        setJobs([]);
        return;
      }
      setJobs(extractJobs(data));
    } catch {
      setError("Network error while loading jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/history", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to load history");
        setHistory([]);
        return;
      }
      setHistory(extractHistory(data));
    } catch {
      setError("Network error while loading history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === "jobs") {
      void loadJobs();
      void loadJobStats();
    } else {
      void loadHistory();
      void loadHistoryStats();
    }
  }, [tab, loadJobs, loadHistory, loadJobStats, loadHistoryStats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = tab === "jobs" ? jobs : history;

    return data.filter(item => {
      const matchStatus = view === "all" ? true : normalizeStatus(item.status) === view;
      const matchQuery = !q ||
                         (typeof item.createdBy === "object" && item.createdBy?.name?.toLowerCase().includes(q)) ||
                         (typeof item.createdBy === "object" && item.createdBy?.number?.includes(q));
      return matchStatus && matchQuery;
    });
  }, [jobs, history, tab, view, query]);

  useEffect(() => {
    setPage(1);
  }, [view, query, tab]);

  const totalPages = Math.ceil(visible.length / pageSize) || 1;
  const paginatedData = visible.slice((page - 1) * pageSize, page * pageSize);

  const handleCancelSubmit = async () => {
    if (!selectedJob || !token || tab !== "jobs") return;
    setBusyId("cancel");
    setActionError(null);
    try {
      const response = await fetch(`/api/jobs/${selectedJob._id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Failed to cancel job");
      } else {
        setModalMode(null);
        setSelectedJob(null);
        loadJobs();
        loadJobStats();
      }
    } catch {
      setActionError("Network error calling PATCH /api/jobs/:id/cancel");
    } finally {
      setBusyId(null);
    }
  };

  const canCancel = (status: string) => {
    const s = normalizeStatus(status);
    return s === "submitted" || s === "queued";
  };

  return (
    <div className="space-y-6">
      {/* Top right refresh icon */}
      <div className="flex justify-end -mt-16 sm:-mt-20 relative z-10 mb-4">
        <button
          onClick={() => tab === "jobs" ? void loadJobs() : void loadHistory()}
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tab === "jobs" ? (
          <>
            <StatCard label="Total Jobs" value={jobStats.jobs} accentColor="accent" />
            <StatCard label="Submitted" value={jobStats.submitted} accentColor="warning" />
            <StatCard label="Queued" value={jobStats.queued} accentColor="warning" />
            <StatCard label="Printing" value={jobStats.printing} accentColor="accent" />
          </>
        ) : (
          <>
            <StatCard label="Total History" value={historyStats.jobs} accentColor="accent" />
            <StatCard label="Completed" value={historyStats.completed} accentColor="print-request" />
            <StatCard label="Cancelled" value={historyStats.cancelled} accentColor="danger" />
            <StatCard label="Failed" value={historyStats.failed} accentColor="danger" />
          </>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("jobs")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            tab === "jobs"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Jobs
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            tab === "history"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input
            type="text"
            placeholder="Search by name or number..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border border-border rounded-lg px-4 py-2 bg-surface text-sm w-full md:w-96 shadow-sm"
          />
          <select
            value={view}
            onChange={e => setView(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm shadow-sm"
          >
            <option value="all">All {tab === "jobs" ? "Jobs" : "History"}</option>
            {tab === "jobs" ? (
              <>
                <option value="submitted">Submitted</option>
                <option value="queued">Queued</option>
                <option value="printing">Printing</option>
                <option value="cancelled">Cancelled</option>
              </>
            ) : (
              <>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </>
            )}
          </select>
        </div>

        {/* Columns Dropdown */}
        <div className="relative">
          <button
            onClick={() => setColsMenuOpen(!colsMenuOpen)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm flex items-center gap-2"
          >
            Columns
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {colsMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-lg z-20 p-2">
              {Object.entries(cols).map(([key, isVisible]) => (
                <label key={key} className="flex items-center gap-2 p-2 hover:bg-surface-muted rounded cursor-pointer text-sm capitalize">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => setCols(prev => ({ ...prev, [key]: !prev[key as keyof typeof cols] }))}
                    className="rounded"
                  />
                  {key}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-surface-muted/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.createdBy && <th className="px-4 py-3 font-medium">Created by</th>}
                {cols.cost && <th className="px-4 py-3 font-medium">Cost</th>}
                {cols.createdAt && <th className="px-4 py-3 font-medium">Created At</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">Loading {tab}…</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No {tab} in this view.</td></tr>
              ) : (
                paginatedData.map((item) => {
                  const status = normalizeStatus(item.status);
                  const by = item.createdBy;
                  const phone = typeof by === "object" && by?.number ? by.number : null;
                  const Badge = tab === "jobs" ? JobStatusBadge : HistoryStatusBadge;

                  return (
                    <tr
                      key={item._id}
                      className="border-b border-border/70 last:border-b-0 hover:bg-surface-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedJob(item); setModalMode("view"); }}
                    >
                      {cols.status && <td className="px-4 py-4"><Badge status={status} /></td>}
                      {cols.createdBy && (
                        <td className="px-4 py-4">
                          <div className="font-medium">{createdByLabel(item)}</div>
                          {phone ? <div className="mt-0.5 text-xs text-muted">{phone}</div> : null}
                        </td>
                      )}
                      {cols.cost && <td className="px-4 py-4 text-muted">{item.cost || "—"}</td>}
                      {cols.createdAt && <td className="px-4 py-4 text-muted">{formatWhen(item.createdAt)}</td>}
                      {cols.actions && (
                        <td className="px-4 py-4">
                          <div className="flex justify-end items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedJob(item); setModalMode("view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                            {tab === "jobs" && canCancel(status) && (
                              <button onClick={(e) => { e.stopPropagation(); setSelectedJob(item); setModalMode("cancel"); }} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!loading && paginatedData.length > 0 && (
          <div className="border-t border-border bg-surface px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted">
              Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, visible.length)}</span> of <span className="font-medium">{visible.length}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border border-border bg-surface text-sm hover:bg-surface-muted transition disabled:opacity-50"
              >
                Previous
              </button>
              <div className="px-3 py-1 text-sm font-medium">Page {page} of {totalPages}</div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md border border-border bg-surface text-sm hover:bg-surface-muted transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalMode === "view"} onClose={() => { setModalMode(null); setSelectedJob(null); }} title={tab === "jobs" ? "Job Details" : "History Details"}>
        {selectedJob && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Status</p>{tab === "jobs" ? <JobStatusBadge status={normalizeStatus(selectedJob.status)} /> : <HistoryStatusBadge status={normalizeStatus(selectedJob.status)} />}</div>
              <div><p className="text-xs text-muted mb-1">Created By</p><p className="font-medium">{createdByLabel(selectedJob)}</p></div>
              <div><p className="text-xs text-muted mb-1">Cost</p><p className="font-medium">{selectedJob.cost || "—"}</p></div>
              <div><p className="text-xs text-muted mb-1">Created At</p><p className="font-medium">{formatWhen(selectedJob.createdAt)}</p></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "cancel"} onClose={() => { setModalMode(null); setSelectedJob(null); setActionError(null); }} title="Cancel Job">
        {selectedJob && tab === "jobs" && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to cancel this job?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setModalMode(null); setSelectedJob(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Dismiss</button>
              <button type="button" onClick={handleCancelSubmit} disabled={busyId === "cancel"} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
