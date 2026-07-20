"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import type { ListShopsResponse, Shop } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { ShopIcon, EyeIcon, PencilIcon, TrashIcon, RefreshIcon, PlusIcon, PowerIcon, WifiIcon, WifiOffIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { ShopForm } from "@/components/shop-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Types ────────────────────────────────────────────────────────────────────
interface ShopStats {
  shops: number;
  online: number;
  offline: number;
  disabled: number;
}

// Timings arrive as a fixed 7-entry array, Monday first.
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Shops carry an `imageFile` id; the bytes come from the authenticated
 * /api/files proxy. Older records may still only have a plain `imageUrl`.
 */
function ShopImage({ shop, token, className }: { shop: Shop; token: string | null; className: string }) {
  const [failed, setFailed] = useState(false);

  const src = shop.imageFile && token
    ? `/api/files/${shop.imageFile}?token=${encodeURIComponent(token)}`
    : shop.imageUrl;

  if (!src || failed) {
    return (
      <div className={`${className} flex items-center justify-center rounded-lg bg-surface-muted text-muted`}>
        <ShopIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={shop.name}
      onError={() => setFailed(true)}
      className={`${className} rounded-lg border border-border object-cover`}
    />
  );
}

function StatusPill({ online, disabled }: { online?: boolean; disabled?: boolean }) {
  if (online) return <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Online</span>;
  if (disabled) return <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">Disabled</span>;
  return <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Offline</span>;
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
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "delete" | "toggle" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    image: true,
    name: true,
    address: true,
    contact: true,
    maps: true,
    status: true,
    actions: true
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch shops list and stats in parallel
      const [shopsRes, statsRes] = await Promise.all([
        fetch("/api/shops",       { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/stats/shops", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);

      const [shopsData, statsData] = await Promise.all([
        shopsRes.json(),
        statsRes.json(),
      ]);

      if (!shopsRes.ok || shopsData.success === false) {
        setError(shopsData.error || shopsData.message || "Failed to load shops");
        setShops([]);
      } else {
        setShops(extractShops(shopsData));
      }

      
      // Shop stats from dedicated endpoint
      if (statsData.success && statsData.data) {
        console.log("backend shops stats", statsData.data)
        setShopStats(statsData.data.stats as ShopStats);
      }
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
      const matchSearch = !q || shop.name.toLowerCase().includes(q) || shop.address.toLowerCase().includes(q) || shop.contactNumber?.includes(q);
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

  // Derive display stats — prefer the dedicated stats API, fall back to local computation
  const displayStats = useMemo(() => {
    if (shopStats) return shopStats;
    const total    = shops.length;
    const online   = shops.filter(s => s.isOnline && !s.isDisabled).length;
    const disabled = shops.filter(s => s.isDisabled).length;
    const offline  = total - online - disabled;
    return { shops: total, online, offline, disabled };
  }, [shopStats, shops]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Shops Report", 14, 15);
    
    const headers = ["#"];
    if (cols.name) headers.push("Name");
    if (cols.address) headers.push("Address");
    if (cols.contact) headers.push("Contact");
    if (cols.maps) headers.push("Google Maps");
    if (cols.status) headers.push("Status");

    const tableData = filtered.map((shop, index) => {
      const row = [String(index + 1)];
      if (cols.name) row.push(shop.name);
      if (cols.address) row.push(shop.address);
      if (cols.contact) row.push(shop.contactNumber || "—");
      if (cols.maps) row.push(shop.googleMapsLink || "—");
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

  const openModal = (shop: Shop, mode: "view" | "edit" | "delete" | "toggle") => {
    setSelectedShop(shop);
    setModalMode(mode);
    setActionError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedShop(null);
  };

  const handleToggleDisabled = async () => {
    if (!selectedShop || !token) return;
    setBusy(true);
    setActionError(null);

    const nextDisabled = !selectedShop.isDisabled;

    try {
      const response = await fetch(`/api/shops/${selectedShop._id}/isDisabled`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDisabled: nextDisabled }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to update shop status");
      } else {
        closeModal();
        load();
      }
    } catch {
      setActionError("Network error calling PATCH /api/shops/:id/isDisabled");
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
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium !text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Create Shop
        </Link>
        <button 
          onClick={() => void load()} 
          className="rounded-lg border border-border bg-surface p-2 text-sm  font-medium hover:bg-surface-muted transition shadow-sm text-muted hover:text-foreground"
          title="Refresh Data"
        >
          <RefreshIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Shops" value={displayStats.shops} icon={<ShopIcon className="w-5 h-5" />} accentColor="accent" />
        <StatCard label="Online" value={displayStats.online} icon={<WifiIcon className="w-5 h-5" />} accentColor="accent" colorValue />
        <StatCard label="Offline" value={displayStats.offline} icon={<WifiOffIcon className="w-5 h-5" />} accentColor="danger" colorValue />
        <StatCard label="Disabled" value={displayStats.disabled} icon={<PowerIcon className="w-5 h-5" />} accentColor="neutral" colorValue />
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
                <th className="px-4 py-3 font-medium w-12">#</th>
                {cols.image && <th className="px-4 py-3 font-medium">Image</th>}
                {cols.name && <th className="px-4 py-3 font-medium">Name</th>}
                {cols.address && <th className="px-4 py-3 font-medium">Address</th>}
                {cols.contact && <th className="px-4 py-3 font-medium">Contact</th>}
                {cols.maps && <th className="px-4 py-3 font-medium">Google Maps</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Loading shops...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No shops found.</td></tr>
              ) : (
                paginatedData.map((shop, index) => {
                  const addressDisplay = shop.address.length > 15 ? shop.address.substring(0, 15) + "..." : shop.address;
                  return (
                    <tr
                      key={shop._id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors"
                      onClick={() => openModal(shop, "view")}
                    >
                      <td className="px-4 py-3 text-muted tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                      {cols.image && (
                        <td className="px-4 py-3"><ShopImage shop={shop} token={token} className="h-10 w-10" /></td>
                      )}
                      {cols.name && (
                        <td className="px-4 py-3 font-medium">{shop.name}</td>
                      )}
                      {cols.address && <td className="px-4 py-3 text-muted max-w-[200px]" title={shop.address}>{addressDisplay}</td>}
                      {cols.contact && <td className="px-4 py-3 text-muted">{shop.contactNumber || "—"}</td>}
                      {cols.maps && (
                        <td className="px-4 py-3">
                          {shop.googleMapsLink ? (
                            <a
                              href={shop.googleMapsLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-accent hover:underline"
                            >
                              Open in Maps
                            </a>
                          ) : <span className="text-muted">—</span>}
                        </td>
                      )}
                      {cols.status && <td className="px-4 py-3"><StatusPill online={shop.isOnline} disabled={shop.isDisabled} /></td>}
                      {cols.actions && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openModal(shop, "view"); }} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openModal(shop, "edit"); }} className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openModal(shop, "toggle"); }}
                              title={shop.isDisabled ? "Enable shop" : "Disable shop"}
                              className={`p-1.5 text-muted transition ${shop.isDisabled ? "hover:text-accent" : "hover:text-danger"}`}
                            >
                              <PowerIcon className="w-4 h-4" />
                            </button>
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

      <Modal isOpen={modalMode === "view"} onClose={closeModal} title="Shop Details" size="lg">
        {selectedShop && (
          <div className="space-y-4">
            <ShopImage shop={selectedShop} token={token} className="h-32 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Name</p><p className="font-medium">{selectedShop.name}</p></div>
              <div><p className="text-xs text-muted mb-1">Status</p><StatusPill online={selectedShop.isOnline} disabled={selectedShop.isDisabled} /></div>
              <div className="col-span-2"><p className="text-xs text-muted mb-1">Address</p><p className="font-medium text-sm whitespace-normal">{selectedShop.address}</p></div>
              <div><p className="text-xs text-muted mb-1">Contact Number</p><p className="font-medium">{selectedShop.contactNumber || "—"}</p></div>
              <div>
                <p className="text-xs text-muted mb-1">Google Maps</p>
                {selectedShop.googleMapsLink ? (
                  <a href={selectedShop.googleMapsLink} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">Open in Maps</a>
                ) : <p className="font-medium">—</p>}
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted mb-1">Timings</p>
                <div className="divide-y divide-border rounded-lg border border-border text-sm">
                  {DAY_LABELS.map((day, i) => (
                    <div key={day} className="flex justify-between whitespace-normal px-3 py-2">
                      <span className="text-muted">{day}</span>
                      <span className="font-medium">{selectedShop.timings?.[i] || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "edit"} onClose={closeModal} title="Edit Shop" size="xl">
        {selectedShop && (
          <ShopForm
            // Remount when switching shops so the form re-seeds its state.
            key={selectedShop._id}
            shop={selectedShop}
            embedded
            onCancel={closeModal}
            onSaved={() => {
              closeModal();
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={modalMode === "toggle"}
        onClose={closeModal}
        title={selectedShop?.isDisabled ? "Enable Shop" : "Disable Shop"}
      >
        {selectedShop && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">
              {selectedShop.isDisabled ? (
                <>Enable <strong>{selectedShop.name}</strong>? It will become visible to customers again.</>
              ) : (
                <>Disable <strong>{selectedShop.name}</strong>? Customers will no longer be able to send it print jobs.</>
              )}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button
                type="button"
                onClick={handleToggleDisabled}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${selectedShop.isDisabled ? "bg-accent hover:bg-accent-hover" : "bg-danger hover:bg-danger/90"}`}
              >
                {busy ? "Saving…" : selectedShop.isDisabled ? "Enable Shop" : "Disable Shop"}
              </button>
            </div>
          </div>
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
