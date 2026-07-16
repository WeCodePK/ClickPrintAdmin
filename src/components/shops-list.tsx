"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [capFilter, setCapFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const capQ = capFilter.trim().toLowerCase();
    
    return shops.filter(shop => {
      const matchSearch = !q || shop.name.toLowerCase().includes(q) || shop.address.toLowerCase().includes(q) || shop.walletNumber?.includes(q);
      const matchStatus = statusFilter === "all" ? true : 
                          statusFilter === "disabled" ? shop.isDisabled :
                          statusFilter === "online" ? shop.isOnline && !shop.isDisabled :
                          statusFilter === "offline" ? !shop.isOnline && !shop.isDisabled : true;
      const matchCap = !capQ || shop.capabilities?.some(c => c.toLowerCase().includes(capQ));
      
      return matchSearch && matchStatus && matchCap;
    });
  }, [shops, query, statusFilter, capFilter]);

  const stats = useMemo(() => {
    const total = shops.length;
    const online = shops.filter(s => s.isOnline && !s.isDisabled).length;
    return { total, online };
  }, [shops]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Shops Report", 14, 15);
    
    const tableData = filtered.map(shop => [
      shop.name,
      shop.address,
      shop.walletNumber || "—",
      shop.isDisabled ? "Disabled" : shop.isOnline ? "Online" : "Offline",
      shop.capabilities?.join(", ") || "—"
    ]);

    autoTable(doc, {
      head: [["Name", "Address", "Wallet", "Status", "Capabilities"]],
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Active Shops" value={stats.total} icon={<ShopIcon />} accentColor="accent" />
        <StatCard label="Online Shops" value={stats.online} accentColor="print-request" />
        <StatCard label="Most Active Shop" value={DEMO_METRICS.mostActiveShopName} isDemo />
        <StatCard label="New Shops (30d)" value={DEMO_METRICS.shopsAddedLast30Days} isDemo />
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 flex-wrap">
          <input 
            type="text" 
            placeholder="Search shops..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm w-full md:w-56"
          />
          <input 
            type="text" 
            placeholder="Capability filter..." 
            value={capFilter}
            onChange={e => setCapFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm w-full md:w-40"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 bg-surface text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadPDF} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted transition">Download PDF</button>
          <button onClick={() => void load()} className="rounded-lg border border-border bg-surface p-2 text-sm font-medium hover:bg-surface-muted transition text-muted hover:text-foreground" title="Refresh Data"><RefreshIcon className="w-5 h-5" /></button>
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Capabilities</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading shops...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No shops found.</td></tr>
              ) : (
                filtered.map(shop => (
                  <tr key={shop._id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {shop.name}
                      {shop.owner ? <div className="text-[10px] text-muted">Owner: {shop.owner}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-[200px] truncate">{shop.address}</td>
                    <td className="px-4 py-3 text-muted">{shop.walletNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {shop.capabilities?.slice(0, 2).map(c => (
                          <span key={c} className="bg-surface-muted text-muted px-1.5 py-0.5 rounded text-[10px]">{c}</span>
                        ))}
                        {(shop.capabilities?.length || 0) > 2 && <span className="text-[10px] text-muted">+{shop.capabilities!.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill online={shop.isOnline} disabled={shop.isDisabled} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(shop, "view")} className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                        <button onClick={() => openModal(shop, "edit")} className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => openModal(shop, "delete")} className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
