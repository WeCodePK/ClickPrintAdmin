"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { ListPrintersResponse, Printer, PrinterStatsData, Shop } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import {
  PrinterIcon,
  PencilIcon,
  TrashIcon,
  RefreshIcon,
  PlusIcon,
  PowerIcon,
  WifiIcon,
  WifiOffIcon,
  EyeIcon,
} from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  // The backend seeds `lastSeen` with the epoch until a printer first checks in.
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "Never";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** A printer's shop arrives either populated or as a bare id. */
function shopIdOf(printer: Printer): string {
  return typeof printer.shop === "string" ? printer.shop : printer.shop?._id ?? "";
}

function shopNameOf(printer: Printer, shops: Shop[]): string {
  if (typeof printer.shop !== "string" && printer.shop?.name) return printer.shop.name;
  const id = shopIdOf(printer);
  return shops.find(s => s._id === id)?.name ?? "—";
}

function StatusPill({ online, disabled }: { online?: boolean; disabled?: boolean }) {
  if (disabled) return <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">Disabled</span>;
  if (online) return <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Online</span>;
  return <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Offline</span>;
}

function extractPrinters(data: ListPrintersResponse & Record<string, unknown>): Printer[] {
  const candidates = [
    data.data?.printers,
    (data as { printers?: Printer[] }).printers,
    Array.isArray(data.data) ? (data.data as Printer[]) : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (printer): printer is Printer =>
          Boolean(printer) && typeof printer === "object" && typeof (printer as Printer)._id === "string",
      );
    }
  }

  return [];
}

export function PrintersPanel() {
  const { token } = useAuth();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [printerStats, setPrinterStats] = useState<PrinterStatsData | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shopFilter, setShopFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "create" | "edit" | "toggle" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formShopId, setFormShopId] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    name: true,
    shop: true,
    status: true,
    lastSeen: true,
    actions: true,
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const [printersRes, statsRes, shopsRes] = await Promise.all([
        fetch("/api/printers", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/stats/printers", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/shops", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);

      const [printersData, statsData, shopsData] = await Promise.all([
        printersRes.json(),
        statsRes.json(),
        shopsRes.json(),
      ]);

      if (!printersRes.ok || printersData.success === false) {
        setError(printersData.error || printersData.message || "Failed to load printers");
        setPrinters([]);
      } else {
        setPrinters(extractPrinters(printersData));
      }

      if (statsData.success && statsData.data) {
        setPrinterStats(statsData.data.stats as PrinterStatsData);
      }

      if (shopsData.success !== false && shopsData.data?.shops) {
        setShops(shopsData.data.shops as Shop[]);
      }
    } catch {
      setError("Network error while loading printers");
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return printers.filter(printer => {
      const matchSearch =
        !q ||
        printer.name.toLowerCase().includes(q) ||
        shopNameOf(printer, shops).toLowerCase().includes(q);
      const matchShop = shopFilter === "all" || shopIdOf(printer) === shopFilter;
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "disabled" ? printer.isDisabled :
        statusFilter === "online" ? printer.isOnline && !printer.isDisabled :
        statusFilter === "offline" ? !printer.isOnline && !printer.isDisabled : true;

      return matchSearch && matchShop && matchStatus;
    });
  }, [printers, shops, query, shopFilter, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, shopFilter]);

  // Prefer the dedicated stats endpoint, fall back to local computation
  const displayStats = useMemo(() => {
    if (printerStats) return printerStats;
    const total = printers.length;
    const online = printers.filter(p => p.isOnline && !p.isDisabled).length;
    const disabled = printers.filter(p => p.isDisabled).length;
    const offline = total - online - disabled;
    return { printers: total, online, offline, disabled };
  }, [printerStats, printers]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Printers Report", 14, 15);

    const headers = ["#"];
    if (cols.name) headers.push("Name");
    if (cols.shop) headers.push("Shop");
    if (cols.status) headers.push("Status");
    if (cols.lastSeen) headers.push("Last Seen");

    const tableData = filtered.map((printer, index) => {
      const row = [String(index + 1)];
      if (cols.name) row.push(printer.name);
      if (cols.shop) row.push(shopNameOf(printer, shops));
      if (cols.status) row.push(printer.isDisabled ? "Disabled" : printer.isOnline ? "Online" : "Offline");
      if (cols.lastSeen) row.push(formatWhen(printer.lastSeen));
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 217, 163] }, // accent color
    });

    doc.save("printers-report.pdf");
  };

  const openModal = (printer: Printer, mode: "view" | "edit" | "toggle" | "delete") => {
    setSelectedPrinter(printer);
    setModalMode(mode);
    setFormName(printer.name);
    setFormShopId(shopIdOf(printer));
    setActionError(null);
  };

  const openCreateModal = () => {
    setSelectedPrinter(null);
    setFormName("");
    setFormShopId("");
    setActionError(null);
    setModalMode("create");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedPrinter(null);
    setActionError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formShopId || !formName.trim()) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/printers/${formShopId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to create printer");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling POST /api/printers/:shopId");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrinter || !token || !formName.trim()) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/printers/${shopIdOf(selectedPrinter)}/${selectedPrinter._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to update printer");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling PUT /api/printers/:shopId/:printerId");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!selectedPrinter || !token) return;
    setBusy(true);
    setActionError(null);

    const nextDisabled = !selectedPrinter.isDisabled;

    try {
      const response = await fetch(
        `/api/printers/${shopIdOf(selectedPrinter)}/${selectedPrinter._id}/isDisabled`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isDisabled: nextDisabled }),
        },
      );
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to update printer status");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling PATCH /api/printers/:shopId/:printerId/isDisabled");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPrinter || !token) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/printers/${shopIdOf(selectedPrinter)}/${selectedPrinter._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to delete printer");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling DELETE /api/printers/:shopId/:printerId");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top right actions */}
      <div className="flex justify-end items-center gap-2 -mt-16 sm:-mt-20 relative z-10 mb-4">
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Printer
        </button>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Printers" value={loading ? "—" : displayStats.printers} icon={<PrinterIcon className="w-5 h-5" />} accentColor="accent" />
        <StatCard label="Online" value={loading ? "—" : displayStats.online} icon={<WifiIcon className="w-5 h-5" />} accentColor="accent" colorValue />
        <StatCard label="Offline" value={loading ? "—" : displayStats.offline} icon={<WifiOffIcon className="w-5 h-5" />} accentColor="danger" colorValue />
        <StatCard label="Disabled" value={loading ? "—" : displayStats.disabled} icon={<PowerIcon className="w-5 h-5" />} accentColor="neutral" colorValue />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input
            type="text"
            placeholder="Search printers..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border border-border rounded-lg px-4 py-2 bg-surface text-sm w-full md:w-64 shadow-sm"
          />
          <select
            value={shopFilter}
            onChange={e => setShopFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm shadow-sm"
          >
            <option value="all">All Shops</option>
            {shops.map(shop => (
              <option key={shop._id} value={shop._id}>{shop.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={downloadPDF} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm">Download PDF</button>

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
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-muted/50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium w-12">#</th>
                {cols.name && <th className="px-4 py-3 font-medium">Name</th>}
                {cols.shop && <th className="px-4 py-3 font-medium">Shop</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.lastSeen && <th className="px-4 py-3 font-medium">Last Seen</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading printers...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No printers found.</td></tr>
              ) : (
                paginatedData.map((printer, index) => (
                  <tr
                    key={printer._id}
                    className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors"
                    onClick={() => openModal(printer, "view")}
                  >
                    <td className="px-4 py-3 text-muted tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                    {cols.name && <td className="px-4 py-3 font-medium">{printer.name}</td>}
                    {cols.shop && <td className="px-4 py-3 text-muted">{shopNameOf(printer, shops)}</td>}
                    {cols.status && <td className="px-4 py-3"><StatusPill online={printer.isOnline} disabled={printer.isDisabled} /></td>}
                    {cols.lastSeen && <td className="px-4 py-3 text-muted">{formatWhen(printer.lastSeen)}</td>}
                    {cols.actions && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openModal(printer, "view"); }} title="View printer" className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); openModal(printer, "edit"); }} title="Rename printer" className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openModal(printer, "toggle"); }}
                            title={printer.isDisabled ? "Enable printer" : "Disable printer"}
                            className={`p-1.5 text-muted transition ${printer.isDisabled ? "hover:text-accent" : "hover:text-danger"}`}
                          >
                            <PowerIcon className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openModal(printer, "delete"); }} title="Delete printer" className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!loading && paginatedData.length > 0 && (
          <div className="border-t border-border bg-surface px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted">
              Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> results
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

      <Modal isOpen={modalMode === "view"} onClose={closeModal} title="Printer Details">
        {selectedPrinter && (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted mb-1">Name</p><p className="font-medium">{selectedPrinter.name}</p></div>
            <div><p className="text-xs text-muted mb-1">Status</p><StatusPill online={selectedPrinter.isOnline} disabled={selectedPrinter.isDisabled} /></div>
            <div><p className="text-xs text-muted mb-1">Shop</p><p className="font-medium">{shopNameOf(selectedPrinter, shops)}</p></div>
            <div><p className="text-xs text-muted mb-1">Last Seen</p><p className="font-medium">{formatWhen(selectedPrinter.lastSeen)}</p></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "create"} onClose={closeModal} title="Add Printer">
        <form onSubmit={handleCreate} className="space-y-4">
          {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Shop</label>
            <select
              value={formShopId}
              onChange={e => setFormShopId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
              required
            >
              <option value="">Choose a shop...</option>
              {shops.map(shop => (
                <option key={shop._id} value={shop._id}>{shop.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Printer Name</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
              placeholder="HP LaserJet P2055dn"
              required
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
            <button type="submit" disabled={busy || !formShopId || !formName.trim()} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">
              {busy ? "Saving…" : "Add Printer"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalMode === "edit"} onClose={closeModal} title="Rename Printer">
        {selectedPrinter && (
          <form onSubmit={handleEdit} className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}

            <div>
              <label className="block text-sm font-medium mb-1">Shop</label>
              <p className="text-sm text-muted">{shopNameOf(selectedPrinter, shops)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Printer Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
                placeholder="HP LaserJet"
                required
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="submit" disabled={busy || !formName.trim()} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={modalMode === "toggle"}
        onClose={closeModal}
        title={selectedPrinter?.isDisabled ? "Enable Printer" : "Disable Printer"}
      >
        {selectedPrinter && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">
              {selectedPrinter.isDisabled ? (
                <>Enable <strong>{selectedPrinter.name}</strong>? It will start accepting print jobs again.</>
              ) : (
                <>Disable <strong>{selectedPrinter.name}</strong>? It will stop accepting print jobs.</>
              )}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button
                type="button"
                onClick={handleToggleDisabled}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${selectedPrinter.isDisabled ? "bg-accent hover:bg-accent-hover" : "bg-danger hover:bg-danger/90"}`}
              >
                {busy ? "Saving…" : selectedPrinter.isDisabled ? "Enable Printer" : "Disable Printer"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={closeModal} title="Delete Printer">
        {selectedPrinter && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">
              Are you sure you want to delete <strong>{selectedPrinter.name}</strong> from{" "}
              <strong>{shopNameOf(selectedPrinter, shops)}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={busy} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
