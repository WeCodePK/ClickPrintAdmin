"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import type { ListShopsResponse, Shop } from "@/lib/types";
import { DEMO_METRICS } from "@/lib/demo-data";
import { StatCard } from "@/components/ui/stat-card";
import { ShopIcon, EyeIcon, PencilIcon, TrashIcon, RefreshIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function StatusPill({ online, disabled }: { online?: boolean; disabled?: boolean }) {
  if (disabled) return <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Disabled</span>;
  if (online) return <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Online</span>;
  return <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">Offline</span>;
}

function extractShops(data: ListShopsResponse & Record<string, unknown>): Shop[] {
  const candidates = [
    data.data?.shops,
    (data as { shops?: Shop[] }).shops,
    Array.isArray(data.data) ? (data.data as Shop[]) : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (shop): shop is Shop =>
          Boolean(shop) && typeof shop === "object" && typeof (shop as Shop)._id === "string",
      );
    }
  }

  return [];
}

export function ShopsList() {
  const { token } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    name: true,
    address: true,
    wallet: true,
    capabilities: true,
    status: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/shops", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to load shops");
        setShops([]);
        return;
      }

      setShops(extractShops(data));
    } catch {
      setError("Network error while loading shops");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    return shops.filter(shop => {
      const matchSearch = !q || shop.name.toLowerCase().includes(q) || shop.address.toLowerCase().includes(q) || shop.walletNumber?.includes(q);
      const matchStatus = statusFilter === "all" ? true : 
                          statusFilter === "disabled" ? shop.isDisabled :
                          statusFilter === "online" ? shop.isOnline && !shop.isDisabled :
                          statusFilter === "offline" ? !shop.isOnline && !shop.isDisabled : true;
      
      return matchSearch && matchStatus;
    });
  }, [shops, query, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const stats = useMemo(() => {
    const total = shops.length;
    const online = shops.filter(s => s.isOnline && !s.isDisabled).length;
    return { total, online };
  }, [shops]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Shops Report", 14, 15);
    
    const headers = [];
    if (cols.name) headers.push("Name");
    if (cols.address) headers.push("Address");
    if (cols.wallet) headers.push("Wallet");
    if (cols.capabilities) headers.push("Capabilities");
    if (cols.status) headers.push("Status");
    
    const tableData = filtered.map(shop => {
      const row = [];
      if (cols.name) row.push(shop.name);
      if (cols.address) row.push(shop.address);
      if (cols.wallet) row.push(shop.walletNumber || "—");
      if (cols.capabilities) row.push(shop.capabilities?.join(", ") || "—");
      if (cols.status) row.push(shop.isDisabled ? "Disabled" : shop.isOnline ? "Online" : "Offline");
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 217, 163] } // accent color
    });

    doc.save("shops-report.pdf");
  };

  const openModal = (shop: Shop, mode: "view" | "edit" | "delete") => {
    setSelectedShop(shop);
    setModalMode(mode);
    setActionError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedShop(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !token) return;
    setBusy(true);
    setActionError(null);
    
    try {
      // In this minimal frontend pass, we just hit the PUT endpoint, expecting an error.
      const response = await fetch(`/api/shops/${selectedShop._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: selectedShop.name }), // sending dummy update to trigger backend response
      });
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Backend endpoint missing or failed. Showing real error.");
      } else {
        closeModal();
        load();
      }
    } catch (err) {
      setActionError("Network error calling PUT /api/shops/:id");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedShop || !token) return;
    setBusy(true);
    setActionError(null);
    
    try {
      const response = await fetch(`/api/shops/${selectedShop._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        setActionError(data.error || "Backend endpoint missing or failed. Showing real error.");
      } else {
        closeModal();
        load();
      }
    } catch (err) {
      setActionError("Network error calling DELETE /api/shops/:id");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top right actions */}
      <div className="flex justify-end items-center gap-2 -mt-16 sm:-mt-20 relative z-10 mb-4">
        <Link
          href="/shops/create"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Create Shop
        </Link>
        <button 
          onClick={() => void load()} 
          className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Active Shops" value={stats.total} icon={<ShopIcon />} accentColor="accent" />
        <StatCard label="Online Shops" value={stats.online} accentColor="print-request" />
        <StatCard label="Most Active Shop" value={DEMO_METRICS.mostActiveShopName} isDemo />
        <StatCard label="New Shops (30d)" value={DEMO_METRICS.shopsAddedLast30Days} isDemo />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input 
            type="text" 
            placeholder="Search shops..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border border-border rounded-lg px-4 py-2 bg-surface text-sm w-full md:w-64 shadow-sm"
          />
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
                {cols.name && <th className="px-4 py-3 font-medium">Name</th>}
                {cols.address && <th className="px-4 py-3 font-medium">Address</th>}
                {cols.wallet && <th className="px-4 py-3 font-medium">Wallet</th>}
                {cols.capabilities && <th className="px-4 py-3 font-medium">Capabilities</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading shops...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No shops found.</td></tr>
              ) : (
                paginatedData.map(shop => {
                  const addressDisplay = shop.address.length > 15 ? shop.address.substring(0, 15) + "..." : shop.address;
                  return (
                    <tr 
                      key={shop._id} 
                      className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors"
                      onClick={() => openModal(shop, "view")}
                    >
                      {cols.name && (
                        <td className="px-4 py-3 font-medium">
                          {shop.name}
                          {shop.owner ? <div className="text-[10px] text-muted">Owner: {shop.owner}</div> : null}
                        </td>
                      )}
                      {cols.address && <td className="px-4 py-3 text-muted max-w-[200px]" title={shop.address}>{addressDisplay}</td>}
                      {cols.wallet && <td className="px-4 py-3 text-muted">{shop.walletNumber || "—"}</td>}
                      {cols.capabilities && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {shop.capabilities?.slice(0, 2).map(c => (
                              <span key={c} className="bg-surface-muted text-muted px-1.5 py-0.5 rounded text-[10px]">{c}</span>
                            ))}
                            {(shop.capabilities?.length || 0) > 2 && <span className="text-[10px] text-muted">+{shop.capabilities!.length - 2}</span>}
                          </div>
                        </td>
                      )}
                      {cols.status && <td className="px-4 py-3"><StatusPill online={shop.isOnline} disabled={shop.isDisabled} /></td>}
                      {cols.actions && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openModal(shop, "view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openModal(shop, "edit"); }} className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openModal(shop, "delete"); }} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
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

      <Modal isOpen={modalMode === "view"} onClose={closeModal} title="Shop Details">
        {selectedShop && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Name</p><p className="font-medium">{selectedShop.name}</p></div>
              <div><p className="text-xs text-muted mb-1">Status</p><StatusPill online={selectedShop.isOnline} disabled={selectedShop.isDisabled} /></div>
              <div className="col-span-2"><p className="text-xs text-muted mb-1">Address</p><p className="font-medium text-sm whitespace-normal">{selectedShop.address}</p></div>
              <div><p className="text-xs text-muted mb-1">Wallet Number</p><p className="font-medium">{selectedShop.walletNumber || "—"}</p></div>
              <div><p className="text-xs text-muted mb-1">Owner</p><p className="font-medium">{selectedShop.owner}</p></div>
              <div className="col-span-2">
                <p className="text-xs text-muted mb-1">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {selectedShop.capabilities?.map(c => <span key={c} className="bg-surface-muted px-2 py-1 rounded text-xs">{c}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "edit"} onClose={closeModal} title="Edit Shop">
        {selectedShop && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" value={selectedShop.name} readOnly className="w-full border border-border rounded-lg px-3 py-2 opacity-70 bg-surface-muted" />
            </div>
            <p className="text-xs text-muted">Admin-edit of shops is currently unsupported in the backend. Submitting will trigger a 403 error.</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={closeModal} title="Delete Shop">
        {selectedShop && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">Are you sure you want to delete the shop <strong>{selectedShop.name}</strong>?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button type="button" onClick={handleDeleteSubmit} disabled={busy} className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
