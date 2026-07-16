"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { ListTopUpsResponse, TopUp, TopUpStatus } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { TopupIcon, EyeIcon, TrashIcon, RefreshIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function normalizeStatus(value: unknown): TopUpStatus {
  if (typeof value !== "string") return "pending";
  const v = value.toLowerCase();
  if (v === "approve" || v === "approved") return "approved";
  if (v === "decline" || v === "declined" || v === "rejected") return "declined";
  return "pending";
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: TopUpStatus }) {
  const styles: Record<TopUpStatus, string> = {
    pending: "bg-warning-soft text-warning",
    approved: "bg-accent-soft text-accent",
    declined: "bg-danger-soft text-danger",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

function extractTopups(data: ListTopUpsResponse): TopUp[] {
  const raw = data.data?.topups;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is TopUp => Boolean(item?._id))
    .map((item) => ({
      ...item,
      amount: Number(item.amount) || 0,
      status: normalizeStatus(item.status),
    }));
}

function createdByLabel(topup: TopUp) {
  const by = topup.createdBy;
  if (!by) return "—";
  if (typeof by === "string") return by;
  return by.name || by.number || by._id;
}

function attachmentLabel(topup: TopUp, token: string | null, truncate: boolean = false) {
  const file = topup.ppfid;
  if (!file) return "—";
  if (typeof file === "string") return file;
  
  let name = file.originalName || file._id || "";
  if (truncate && name.length > 20) {
    name = name.substring(0, 15) + "...";
  }

  if (file._id && token) {
    const url = `/api/files/${file._id}?token=${token}&name=${encodeURIComponent(file.originalName || file._id)}`;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={`text-accent hover:underline font-medium inline-flex items-center gap-1 ${truncate ? "max-w-[150px] truncate" : "break-all"}`} onClick={e => e.stopPropagation()} title={file.originalName || file._id}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span className={truncate ? "truncate" : ""}>{name}</span>
      </a>
    );
  }
  return <span className={truncate ? "truncate max-w-[150px] inline-block" : "break-all"} title={name}>{name}</span>;
}

const COLORS = {
  pending: "var(--color-warning)",
  approved: "var(--color-accent)",
  declined: "var(--color-danger)"
};

export function TopUpsPanel() {
  const { token } = useAuth();
  
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedTopup, setSelectedTopup] = useState<TopUp | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "delete" | "approve" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    amount: true,
    requestedBy: true,
    attachment: true,
    submitted: true,
    status: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/topups", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to load top-ups");
        setTopups([]);
        return;
      }
      setTopups(extractTopups(data));
    } catch {
      setError("Network error while loading top-ups");
      setTopups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topups.filter(t => {
      const matchStatus = view === "all" ? true : normalizeStatus(t.status) === view;
      const matchQuery = !q || 
                         t.amount.toString().includes(q) || 
                         (typeof t.createdBy === "object" && t.createdBy?.name?.toLowerCase().includes(q)) ||
                         (typeof t.createdBy === "object" && t.createdBy?.number?.includes(q));
      return matchStatus && matchQuery;
    });
  }, [topups, view, query]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [view, query]);

  const stats = useMemo(() => {
    let pending = 0, approved = 0, declined = 0, approvedAmount = 0;
    topups.forEach(t => {
      const s = normalizeStatus(t.status);
      if (s === "pending") pending++;
      else if (s === "approved") { approved++; approvedAmount += t.amount; }
      else declined++;
    });
    return { total: topups.length, pending, approved, declined, approvedAmount };
  }, [topups]);

  const chartData = [
    { name: 'Pending', value: stats.pending, color: COLORS.pending },
    { name: 'Approved', value: stats.approved, color: COLORS.approved },
    { name: 'Declined', value: stats.declined, color: COLORS.declined }
  ].filter(d => d.value > 0);

  const totalPages = Math.ceil(visible.length / pageSize) || 1;
  const paginatedData = visible.slice((page - 1) * pageSize, page * pageSize);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Top-ups Report", 14, 15);
    
    const headers = [];
    if (cols.amount) headers.push("Amount");
    if (cols.requestedBy) headers.push("Requested by");
    if (cols.attachment) headers.push("Attachment");
    if (cols.submitted) headers.push("Submitted");
    if (cols.status) headers.push("Status");
    
    const tableData = visible.map(topup => {
      const row = [];
      if (cols.amount) row.push(formatMoney(topup.amount));
      if (cols.requestedBy) row.push(createdByLabel(topup));
      if (cols.attachment) {
        const file = topup.ppfid;
        if (!file) row.push("—");
        else if (typeof file === "string") row.push(file);
        else row.push(file.originalName || file._id || "—");
      }
      if (cols.submitted) row.push(formatWhen(topup.createdAt));
      if (cols.status) row.push(normalizeStatus(topup.status));
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 217, 163] } // accent color
    });

    doc.save("topups-report.pdf");
  };

  const handleReviewSubmit = async (status: "approved" | "declined") => {
    if (!selectedTopup || !token) return;
    setBusyId("review");
    setActionError(null);
    try {
      const response = await fetch(`/api/topups/${selectedTopup._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to update top-up");
        return;
      }
      setModalMode(null);
      setSelectedTopup(null);
      load();
    } catch {
      setActionError("Network error while updating top-up");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedTopup || !token) return;
    setBusyId("delete");
    setActionError(null);
    try {
      const response = await fetch(`/api/topups/${selectedTopup._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Backend endpoint missing or failed. Showing real error.");
      } else {
        setModalMode(null);
        setSelectedTopup(null);
        load();
      }
    } catch {
      setActionError("Network error calling DELETE /api/topups/:id");
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard label="Total Topups" value={stats.total} icon={<TopupIcon />} accentColor="accent" />
          <StatCard label="Pending" value={stats.pending} accentColor="warning" />
          <StatCard label="Approved (Count)" value={stats.approved} accentColor="print-request" />
          <StatCard label="Approved Amount" value={formatMoney(stats.approvedAmount)} accentColor="credit-wallet" />
        </div>
        <div className="bg-surface rounded-xl border border-border p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-medium text-muted mb-2">Status Breakdown</h3>
          <div className="flex-1 min-h-[160px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} stroke="none">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">No data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input 
            type="text" 
            placeholder="Search by name, number, or exact amount..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border border-border rounded-lg px-4 py-2 bg-surface text-sm w-full md:w-96 shadow-sm"
          />
          <select
            value={view}
            onChange={e => setView(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm shadow-sm"
          >
            <option value="all">All Top-ups</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        
        {/* Columns Dropdown and PDF */}
        <div className="flex gap-3 items-center">
          <button onClick={downloadPDF} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm">Download PDF</button>
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
      </div>

      {error ? <p className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-surface-muted/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                {cols.amount && <th className="px-4 py-3 font-medium">Amount</th>}
                {cols.requestedBy && <th className="px-4 py-3 font-medium">Requested by</th>}
                {cols.attachment && <th className="px-4 py-3 font-medium">Attachment</th>}
                {cols.submitted && <th className="px-4 py-3 font-medium">Submitted</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">Loading top-ups…</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">No top-ups in this view.</td></tr>
              ) : (
                paginatedData.map((topup) => {
                  const status = normalizeStatus(topup.status);
                  const by = topup.createdBy;
                  const phone = typeof by === "object" && by?.number ? by.number : null;

                  return (
                    <tr 
                      key={topup._id} 
                      className="border-b border-border/70 last:border-b-0 hover:bg-surface-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedTopup(topup); setModalMode("view"); }}
                    >
                      {cols.amount && <td className="px-4 py-4 font-medium">{formatMoney(topup.amount)}</td>}
                      {cols.requestedBy && (
                        <td className="px-4 py-4">
                          <div className="font-medium">{createdByLabel(topup)}</div>
                          {phone ? <div className="mt-0.5 text-xs text-muted">{phone}</div> : null}
                        </td>
                      )}
                      {cols.attachment && <td className="px-4 py-4 text-muted">{attachmentLabel(topup, token, true)}</td>}
                      {cols.submitted && <td className="px-4 py-4 text-muted">{formatWhen(topup.createdAt)}</td>}
                      {cols.status && <td className="px-4 py-4"><StatusBadge status={status} /></td>}
                      {cols.actions && (
                        <td className="px-4 py-4">
                          <div className="flex justify-end items-center gap-2">
                            {status === "pending" ? (
                              <>
                                <button disabled={busyId === topup._id} onClick={(e) => { e.stopPropagation(); setSelectedTopup(topup); setModalMode("approve"); }} className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover transition disabled:opacity-60">Approve</button>
                                <button disabled={busyId === topup._id} onClick={(e) => { e.stopPropagation(); setSelectedTopup(topup); setModalMode("decline"); }} className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-1 text-xs font-medium text-danger hover:bg-danger hover:text-white transition disabled:opacity-60">Decline</button>
                              </>
                            ) : null}
                            <button onClick={(e) => { e.stopPropagation(); setSelectedTopup(topup); setModalMode("view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedTopup(topup); setModalMode("delete"); }} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
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

      <Modal isOpen={modalMode === "view"} onClose={() => { setModalMode(null); setSelectedTopup(null); }} title="Top-up Details">
        {selectedTopup && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Amount</p><p className="font-medium">{formatMoney(selectedTopup.amount)}</p></div>
              <div><p className="text-xs text-muted mb-1">Status</p><StatusBadge status={normalizeStatus(selectedTopup.status)} /></div>
              <div><p className="text-xs text-muted mb-1">Requested By</p><p className="font-medium">{createdByLabel(selectedTopup)}</p></div>
              <div><p className="text-xs text-muted mb-1">Submitted At</p><p className="font-medium">{formatWhen(selectedTopup.createdAt)}</p></div>
              <div className="col-span-2">
                <p className="text-xs text-muted mb-1">Attachment</p>
                <div className="font-medium text-sm p-3 bg-surface-muted rounded-lg inline-block">{attachmentLabel(selectedTopup, token, false)}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "approve"} onClose={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} title="Approve Top-up">
        {selectedTopup && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to approve this top-up request for <strong>{formatMoney(selectedTopup.amount)}</strong>?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={() => handleReviewSubmit("approved")} disabled={busyId === "review"} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Confirm Approve</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "decline"} onClose={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} title="Decline Top-up">
        {selectedTopup && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to decline this top-up request for <strong>{formatMoney(selectedTopup.amount)}</strong>?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={() => handleReviewSubmit("declined")} disabled={busyId === "review"} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Decline</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} title="Delete Top-up">
        {selectedTopup && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to delete this top-up request for <strong>{formatMoney(selectedTopup.amount)}</strong>?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setModalMode(null); setSelectedTopup(null); setActionError(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={handleDeleteSubmit} disabled={busyId === "delete"} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
