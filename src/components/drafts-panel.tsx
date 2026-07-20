"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { ListDraftsResponse, Draft, DraftStatsData } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { DocumentIcon, EyeIcon, TrashIcon, RefreshIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string") return "drafts";
  return value.toLowerCase();
}

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    drafts: "bg-warning-soft text-warning",
    ready: "bg-accent-soft text-accent",
    complete: "bg-accent-soft text-accent",
    incomplete: "bg-danger-soft text-danger",
  };
  const style = styles[status.toLowerCase()] || "bg-surface-muted text-muted";
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function extractDrafts(data: ListDraftsResponse): Draft[] {
  const raw = data.data?.drafts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Draft => Boolean(item?._id))
    .map((item) => ({
      ...item,
      status: normalizeStatus(item.status),
    }));
}

function createdByLabel(draft: Draft) {
  const by = draft.createdBy;
  if (!by) return "—";
  if (typeof by === "string") return by;
  return by.name || by.number || by._id;
}

export function DraftsPanel() {
  const { token } = useAuth();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [stats, setStats] = useState<DraftStatsData>({
    drafts: 0,
    ready: 0,
    complete: 0,
    incomplete: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    status: true,
    createdBy: true,
    createdAt: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const loadStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/stats/drafts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      console.log("backend draft stats", data.data)
      if (!response.ok || data.success === false) {
        console.error("Failed to load draft stats");
        return;
      }
      setStats(data.data.stats || {
        drafts: 0,
        ready: 0,
        complete: 0,
        incomplete: 0,
      });
    } catch {
      console.error("Network error while loading draft stats");
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/drafts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to load drafts");
        setDrafts([]);
        return;
      }
      setDrafts(extractDrafts(data));
    } catch {
      setError("Network error while loading drafts");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts.filter(d => {
      const matchStatus = view === "all" ? true : normalizeStatus(d.status) === view;
      const matchQuery = !q ||
                         (typeof d.createdBy === "object" && d.createdBy?.name?.toLowerCase().includes(q)) ||
                         (typeof d.createdBy === "object" && d.createdBy?.number?.includes(q));
      return matchStatus && matchQuery;
    });
  }, [drafts, view, query]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [view, query]);

  const totalPages = Math.ceil(visible.length / pageSize) || 1;
  const paginatedData = visible.slice((page - 1) * pageSize, page * pageSize);

  const handleDeleteSubmit = async () => {
    if (!selectedDraft || !token) return;
    setBusyId("delete");
    setActionError(null);
    try {
      const response = await fetch(`/api/drafts/${selectedDraft._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Failed to delete draft");
      } else {
        setModalMode(null);
        setSelectedDraft(null);
        load();
        loadStats();
      }
    } catch {
      setActionError("Network error calling DELETE /api/drafts/:id");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top right refresh icon */}
      <div className="flex justify-end -mt-16 sm:-mt-20 relative z-10 mb-4">
        <button
          onClick={() => void load()}
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Drafts" value={stats.drafts} icon={<DocumentIcon />} accentColor="warning" />
        <StatCard label="Ready" value={stats.ready} accentColor="accent" />
        <StatCard label="Complete" value={stats.complete} accentColor="print-request" />
        <StatCard label="Incomplete" value={stats.incomplete} accentColor="danger" />
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
            <option value="all">All Drafts</option>
            <option value="drafts">Drafts</option>
            <option value="ready">Ready</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
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
                {key.replace(/([A-Z])/g, ' $1').trim()}
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
                <th className="px-4 py-3 font-medium w-12">#</th>
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.createdBy && <th className="px-4 py-3 font-medium">Created by</th>}
                {cols.createdAt && <th className="px-4 py-3 font-medium">Created At</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">Loading drafts…</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">No drafts in this view.</td></tr>
              ) : (
                paginatedData.map((draft, index) => {
                  const status = normalizeStatus(draft.status);
                  const by = draft.createdBy;
                  const phone = typeof by === "object" && by?.number ? by.number : null;

                  return (
                    <tr
                      key={draft._id}
                      className="border-b border-border/70 last:border-b-0 hover:bg-surface-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedDraft(draft); setModalMode("view"); }}
                    >
                      <td className="px-4 py-4 text-muted tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                      {cols.status && <td className="px-4 py-4"><StatusBadge status={status} /></td>}
                      {cols.createdBy && (
                        <td className="px-4 py-4">
                          <div className="font-medium">{createdByLabel(draft)}</div>
                          {phone ? <div className="mt-0.5 text-xs text-muted">{phone}</div> : null}
                        </td>
                      )}
                      {cols.createdAt && <td className="px-4 py-4 text-muted">{formatWhen(draft.createdAt)}</td>}
                      {cols.actions && (
                        <td className="px-4 py-4">
                          <div className="flex justify-end items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); setModalMode("view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); setModalMode("delete"); }} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
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

      <Modal isOpen={modalMode === "view"} onClose={() => { setModalMode(null); setSelectedDraft(null); }} title="Draft Details">
        {selectedDraft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Status</p><StatusBadge status={normalizeStatus(selectedDraft.status)} /></div>
              <div><p className="text-xs text-muted mb-1">Created By</p><p className="font-medium">{createdByLabel(selectedDraft)}</p></div>
              <div><p className="text-xs text-muted mb-1">Created At</p><p className="font-medium">{formatWhen(selectedDraft.createdAt)}</p></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={() => { setModalMode(null); setSelectedDraft(null); setActionError(null); }} title="Delete Draft">
        {selectedDraft && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to delete this draft?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setModalMode(null); setSelectedDraft(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={handleDeleteSubmit} disabled={busyId === "delete"} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
