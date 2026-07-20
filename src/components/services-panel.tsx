"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type {
  ListServicesResponse,
  Printer,
  Service,
  ServicePrinter,
  ServiceStatsData,
  Shop,
} from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import {
  DocumentIcon,
  PencilIcon,
  TrashIcon,
  RefreshIcon,
  PlusIcon,
  PowerIcon,
  EyeIcon,
  CheckIcon,
  WifiIcon,
  WifiOffIcon,
} from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Suggestions only — the field is free text so any size the backend accepts works. */
const PAGE_TYPE_SUGGESTIONS = ["A4", "A3", "A5", "Letter", "Legal"];

function formatRate(rate: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(rate);
}

/** A service's shop arrives either populated or as a bare id. */
function shopIdOf(service: Service): string {
  return typeof service.shop === "string" ? service.shop : service.shop?._id ?? "";
}

function shopNameOf(service: Service, shops: Shop[]): string {
  if (typeof service.shop !== "string" && service.shop?.name) return service.shop.name;
  const id = shopIdOf(service);
  return shops.find(s => s._id === id)?.name ?? "—";
}

function printerIdOf(entry: ServicePrinter): string {
  return typeof entry.printer === "string" ? entry.printer : entry.printer?._id ?? "";
}

function printerNameOf(entry: ServicePrinter, printers: Printer[]): string {
  if (typeof entry.printer !== "string" && entry.printer?.name) return entry.printer.name;
  const id = printerIdOf(entry);
  return printers.find(p => p._id === id)?.name ?? "—";
}

/** The backend derives `name` from the keys; fall back to the same shape. */
function serviceLabel(service: Service): string {
  if (service.name) return service.name;
  const { pageType, color, sidedness } = service.keys ?? {};
  return [pageType || "—", color ? "CL" : "BW", sidedness ? "DS" : "SS"].join("-");
}

function StatusPill({ disabled }: { disabled?: boolean }) {
  return disabled
    ? <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">Disabled</span>
    : <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Enabled</span>;
}

function extractServices(data: ListServicesResponse & Record<string, unknown>): Service[] {
  const candidates = [
    data.data?.services,
    (data as { services?: Service[] }).services,
    Array.isArray(data.data) ? (data.data as Service[]) : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (service): service is Service =>
          Boolean(service) && typeof service === "object" && typeof (service as Service)._id === "string",
      );
    }
  }

  return [];
}

/**
 * Shops and printers return their stats under `data.stats`; services returns
 * them flat under `data`. Accept either.
 */
function extractServiceStats(data: Record<string, unknown>): ServiceStatsData | null {
  const payload = (data?.data ?? {}) as Record<string, unknown>;
  const raw = (payload.stats ?? payload) as Record<string, unknown>;

  if (typeof raw?.services !== "number") return null;

  return {
    services: raw.services,
    healthy: typeof raw.healthy === "number" ? raw.healthy : 0,
    unhealthy: typeof raw.unhealthy === "number" ? raw.unhealthy : 0,
    dead: typeof raw.dead === "number" ? raw.dead : 0,
  };
}

/** Mirrors the backend's health rule so the cards still work if stats fail. */
function healthOf(service: Service): "healthy" | "unhealthy" | "dead" {
  const entries = service.printers ?? [];
  const online = entries.filter(
    entry => typeof entry.printer !== "string" && entry.printer?.isOnline,
  ).length;

  if (online === 0) return "dead";
  return online === entries.length ? "healthy" : "unhealthy";
}

interface PrinterRow {
  printer: string;
  useAuto: boolean;
}

export function ServicesPanel() {
  const { token } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceStatsData | null>(null);
  const [query, setQuery] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "create" | "edit" | "toggle" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [formShopId, setFormShopId] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formPageType, setFormPageType] = useState("A4");
  const [formColor, setFormColor] = useState(false);
  const [formSidedness, setFormSidedness] = useState(false);
  const [formPrinters, setFormPrinters] = useState<PrinterRow[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Column visibility
  const [cols, setCols] = useState({
    name: true,
    shop: true,
    rate: true,
    pageType: true,
    color: true,
    sides: true,
    printers: true,
    status: true,
    actions: true,
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const [servicesRes, statsRes, shopsRes, printersRes] = await Promise.all([
        fetch("/api/services", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/stats/services", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/shops", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/printers", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);

      const [servicesData, statsData, shopsData, printersData] = await Promise.all([
        servicesRes.json(),
        statsRes.json(),
        shopsRes.json(),
        printersRes.json(),
      ]);

      if (!servicesRes.ok || servicesData.success === false) {
        setError(servicesData.error || servicesData.message || "Failed to load services");
        setServices([]);
      } else {
        setServices(extractServices(servicesData));
      }

      if (statsData.success) {
        setServiceStats(extractServiceStats(statsData));
      }

      if (shopsData.success !== false && shopsData.data?.shops) {
        setShops(shopsData.data.shops as Shop[]);
      }

      if (printersData.success !== false && printersData.data?.printers) {
        setPrinters(printersData.data.printers as Printer[]);
      }
    } catch {
      setError("Network error while loading services");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return services.filter(service => {
      const matchSearch =
        !q ||
        serviceLabel(service).toLowerCase().includes(q) ||
        shopNameOf(service, shops).toLowerCase().includes(q) ||
        (service.keys?.pageType ?? "").toLowerCase().includes(q);
      const matchShop = shopFilter === "all" || shopIdOf(service) === shopFilter;
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "disabled" ? service.isDisabled : !service.isDisabled;

      return matchSearch && matchShop && matchStatus;
    });
  }, [services, shops, query, shopFilter, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, shopFilter, statusFilter]);

  // Prefer the dedicated stats endpoint, fall back to local computation
  const displayStats = useMemo(() => {
    if (serviceStats) return serviceStats;
    const health = services.map(healthOf);
    return {
      services: services.length,
      healthy: health.filter(h => h === "healthy").length,
      unhealthy: health.filter(h => h === "unhealthy").length,
      dead: health.filter(h => h === "dead").length,
    };
  }, [serviceStats, services]);

  /** Only printers at the shop a service belongs to can fulfil it. */
  const printersForForm = useMemo(
    () => printers.filter(p => (typeof p.shop === "string" ? p.shop : p.shop?._id) === formShopId),
    [printers, formShopId],
  );

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Services Report", 14, 15);

    const headers = ["#"];
    if (cols.name) headers.push("Service");
    if (cols.shop) headers.push("Shop");
    if (cols.rate) headers.push("Rate");
    if (cols.pageType) headers.push("Page Type");
    if (cols.color) headers.push("Color");
    if (cols.sides) headers.push("Sides");
    if (cols.printers) headers.push("Printers");
    if (cols.status) headers.push("Status");

    const tableData = filtered.map((service, index) => {
      const row = [String(index + 1)];
      if (cols.name) row.push(serviceLabel(service));
      if (cols.shop) row.push(shopNameOf(service, shops));
      if (cols.rate) row.push(formatRate(service.rate));
      if (cols.pageType) row.push(service.keys?.pageType || "—");
      if (cols.color) row.push(service.keys?.color ? "Color" : "B&W");
      if (cols.sides) row.push(service.keys?.sidedness ? "Double" : "Single");
      if (cols.printers) row.push(String(service.printers?.length ?? 0));
      if (cols.status) row.push(service.isDisabled ? "Disabled" : "Enabled");
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 217, 163] }, // accent color
    });

    doc.save("services-report.pdf");
  };

  const openModal = (service: Service, mode: "view" | "edit" | "toggle" | "delete") => {
    setSelectedService(service);
    setModalMode(mode);
    setActionError(null);
    setFormShopId(shopIdOf(service));
    setFormRate(String(service.rate ?? ""));
    setFormPageType(service.keys?.pageType ?? "A4");
    setFormColor(Boolean(service.keys?.color));
    setFormSidedness(Boolean(service.keys?.sidedness));
    setFormPrinters(
      (service.printers ?? []).map(entry => ({
        printer: printerIdOf(entry),
        useAuto: entry.useAuto === true,
      })),
    );
  };

  const openCreateModal = () => {
    setSelectedService(null);
    setActionError(null);
    setFormShopId("");
    setFormRate("");
    setFormPageType("A4");
    setFormColor(false);
    setFormSidedness(false);
    setFormPrinters([]);
    setModalMode("create");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedService(null);
    setActionError(null);
  };

  const addPrinterRow = () => setFormPrinters(prev => [...prev, { printer: "", useAuto: true }]);

  const updatePrinterRow = (index: number, patch: Partial<PrinterRow>) =>
    setFormPrinters(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removePrinterRow = (index: number) =>
    setFormPrinters(prev => prev.filter((_, i) => i !== index));

  const buildPayload = () => ({
    rate: Number(formRate),
    keys: {
      pageType: formPageType.trim(),
      color: formColor,
      sidedness: formSidedness,
    },
    printers: formPrinters
      .filter(row => row.printer)
      .map(row => ({ useAuto: row.useAuto, printer: row.printer })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formShopId || !formRate.trim()) return;
    setBusy(true);
    setActionError(null);

    const editing = modalMode === "edit" && selectedService;
    const url = editing
      ? `/api/services/${formShopId}/${selectedService._id}`
      : `/api/services/${formShopId}`;

    try {
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(
          data.error || data.message || `Failed to ${editing ? "update" : "create"} service`,
        );
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError(
        `Network error calling ${editing ? "PUT" : "POST"} /api/services/:shopId`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!selectedService || !token) return;
    setBusy(true);
    setActionError(null);

    const nextDisabled = !selectedService.isDisabled;

    try {
      const response = await fetch(
        `/api/services/${shopIdOf(selectedService)}/${selectedService._id}/isDisabled`,
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
        setActionError(data.error || data.message || "Failed to update service status");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling PATCH /api/services/:shopId/:serviceId/isDisabled");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedService || !token) return;
    setBusy(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/services/${shopIdOf(selectedService)}/${selectedService._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setActionError(data.error || data.message || "Failed to delete service");
      } else {
        closeModal();
        void load();
      }
    } catch {
      setActionError("Network error calling DELETE /api/services/:shopId/:serviceId");
    } finally {
      setBusy(false);
    }
  };

  const serviceForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Shop</label>
        {modalMode === "edit" ? (
          // A service cannot move between shops — its id is scoped to the shop.
          <p className="text-sm text-muted">{selectedService ? shopNameOf(selectedService, shops) : "—"}</p>
        ) : (
          <select
            value={formShopId}
            onChange={e => { setFormShopId(e.target.value); setFormPrinters([]); }}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
            required
          >
            <option value="">Choose a shop...</option>
            {shops.map(shop => (
              <option key={shop._id} value={shop._id}>{shop.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Rate (PKR per page)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={formRate}
            onChange={e => setFormRate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
            placeholder="20"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Page Type</label>
          <input
            type="text"
            list="service-page-types"
            value={formPageType}
            onChange={e => setFormPageType(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
            placeholder="A4"
            required
          />
          <datalist id="service-page-types">
            {PAGE_TYPE_SUGGESTIONS.map(type => <option key={type} value={type} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <select
            value={formColor ? "color" : "bw"}
            onChange={e => setFormColor(e.target.value === "color")}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          >
            <option value="bw">Black &amp; White</option>
            <option value="color">Color</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sidedness</label>
          <select
            value={formSidedness ? "double" : "single"}
            onChange={e => setFormSidedness(e.target.value === "double")}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          >
            <option value="single">Single-sided</option>
            <option value="double">Double-sided</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Printers</label>
          <button
            type="button"
            onClick={addPrinterRow}
            disabled={!formShopId}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted transition disabled:opacity-50 flex items-center gap-1"
          >
            <PlusIcon className="w-3 h-3" />
            Add Printer
          </button>
        </div>

        {!formShopId ? (
          <p className="text-sm text-muted">Choose a shop first.</p>
        ) : formPrinters.length === 0 ? (
          <p className="text-sm text-muted">No printers assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {formPrinters.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={row.printer}
                  onChange={e => updatePrinterRow(index, { printer: e.target.value })}
                  className="flex-1 border border-border rounded-lg px-3 py-2 bg-surface text-sm"
                  required
                >
                  <option value="">Choose a printer...</option>
                  {printersForForm.map(printer => (
                    <option key={printer._id} value={printer._id}>{printer.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-muted whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={row.useAuto}
                    onChange={e => updatePrinterRow(index, { useAuto: e.target.checked })}
                    className="rounded"
                  />
                  Auto
                </label>
                <button
                  type="button"
                  onClick={() => removePrinterRow(index)}
                  title="Remove printer"
                  className="p-1.5 text-muted hover:text-danger transition"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {formShopId && printersForForm.length === 0 && (
          <p className="mt-2 text-sm text-muted">This shop has no printers yet.</p>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
        <button
          type="submit"
          disabled={busy || !formShopId || !formRate.trim() || !formPageType.trim()}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
        >
          {busy ? "Saving…" : modalMode === "edit" ? "Save Changes" : "Create Service"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Top right actions */}
      <div className="flex justify-end items-center gap-2 -mt-16 sm:-mt-20 relative z-10 mb-4">
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition shadow-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Create Service
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
        <StatCard label="Total Services" value={loading ? "—" : displayStats.services} icon={<DocumentIcon className="w-5 h-5" />} accentColor="accent" />
        <StatCard label="Healthy" value={loading ? "—" : displayStats.healthy} icon={<CheckIcon className="w-5 h-5" />} accentColor="accent" colorValue />
        <StatCard label="Unhealthy" value={loading ? "—" : displayStats.unhealthy} icon={<WifiIcon className="w-5 h-5" />} accentColor="warning" colorValue />
        <StatCard label="Dead" value={loading ? "—" : displayStats.dead} icon={<WifiOffIcon className="w-5 h-5" />} accentColor="danger" colorValue />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 flex-wrap flex-1">
          <input
            type="text"
            placeholder="Search services..."
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
            <option value="enabled">Enabled</option>
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
                {cols.name && <th className="px-4 py-3 font-medium">Service</th>}
                {cols.shop && <th className="px-4 py-3 font-medium">Shop</th>}
                {cols.rate && <th className="px-4 py-3 font-medium">Rate</th>}
                {cols.pageType && <th className="px-4 py-3 font-medium">Page Type</th>}
                {cols.color && <th className="px-4 py-3 font-medium">Color</th>}
                {cols.sides && <th className="px-4 py-3 font-medium">Sides</th>}
                {cols.printers && <th className="px-4 py-3 font-medium">Printers</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.actions && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted">Loading services...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted">No services found.</td></tr>
              ) : (
                paginatedData.map((service, index) => (
                  <tr
                    key={service._id}
                    className="border-b border-border last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors"
                    onClick={() => openModal(service, "view")}
                  >
                    <td className="px-4 py-3 text-muted tabular-nums">{(page - 1) * pageSize + index + 1}</td>
                    {cols.name && <td className="px-4 py-3 font-medium">{serviceLabel(service)}</td>}
                    {cols.shop && <td className="px-4 py-3 text-muted">{shopNameOf(service, shops)}</td>}
                    {cols.rate && <td className="px-4 py-3 tabular-nums">{formatRate(service.rate)}</td>}
                    {cols.pageType && <td className="px-4 py-3 text-muted">{service.keys?.pageType || "—"}</td>}
                    {cols.color && <td className="px-4 py-3 text-muted">{service.keys?.color ? "Color" : "B&W"}</td>}
                    {cols.sides && <td className="px-4 py-3 text-muted">{service.keys?.sidedness ? "Double" : "Single"}</td>}
                    {cols.printers && <td className="px-4 py-3 text-muted tabular-nums">{service.printers?.length ?? 0}</td>}
                    {cols.status && <td className="px-4 py-3"><StatusPill disabled={service.isDisabled} /></td>}
                    {cols.actions && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openModal(service, "view"); }} title="View service" className="p-1.5 text-muted hover:text-foreground transition"><EyeIcon className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); openModal(service, "edit"); }} title="Edit service" className="p-1.5 text-muted hover:text-accent transition"><PencilIcon className="w-4 h-4" /></button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openModal(service, "toggle"); }}
                            title={service.isDisabled ? "Enable service" : "Disable service"}
                            className={`p-1.5 text-muted transition ${service.isDisabled ? "hover:text-accent" : "hover:text-danger"}`}
                          >
                            <PowerIcon className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openModal(service, "delete"); }} title="Delete service" className="p-1.5 text-muted hover:text-danger transition"><TrashIcon className="w-4 h-4" /></button>
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

      <Modal isOpen={modalMode === "view"} onClose={closeModal} title="Service Details" size="lg">
        {selectedService && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted mb-1">Service</p><p className="font-medium">{serviceLabel(selectedService)}</p></div>
              <div><p className="text-xs text-muted mb-1">Status</p><StatusPill disabled={selectedService.isDisabled} /></div>
              <div><p className="text-xs text-muted mb-1">Shop</p><p className="font-medium">{shopNameOf(selectedService, shops)}</p></div>
              <div><p className="text-xs text-muted mb-1">Rate</p><p className="font-medium">{formatRate(selectedService.rate)}</p></div>
              <div><p className="text-xs text-muted mb-1">Page Type</p><p className="font-medium">{selectedService.keys?.pageType || "—"}</p></div>
              <div><p className="text-xs text-muted mb-1">Color</p><p className="font-medium">{selectedService.keys?.color ? "Color" : "Black & White"}</p></div>
              <div><p className="text-xs text-muted mb-1">Sidedness</p><p className="font-medium">{selectedService.keys?.sidedness ? "Double-sided" : "Single-sided"}</p></div>
            </div>

            <div>
              <p className="text-xs text-muted mb-1">Printers</p>
              {(selectedService.printers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">No printers assigned.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border text-sm">
                  {selectedService.printers?.map((entry, i) => {
                    const printerObj = typeof entry.printer === "string" ? null : entry.printer;
                    return (
                      <div key={printerIdOf(entry) || i} className="flex items-center justify-between px-3 py-2">
                        <span className="font-medium">{printerNameOf(entry, printers)}</span>
                        <span className="flex items-center gap-2">
                          {entry.useAuto && (
                            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Auto</span>
                          )}
                          <span className={`text-xs ${printerObj?.isOnline ? "text-accent" : "text-muted"}`}>
                            {printerObj?.isOnline ? "Online" : "Offline"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "create"} onClose={closeModal} title="Create Service" size="lg">
        {serviceForm}
      </Modal>

      <Modal isOpen={modalMode === "edit"} onClose={closeModal} title="Edit Service" size="lg">
        {selectedService && serviceForm}
      </Modal>

      <Modal
        isOpen={modalMode === "toggle"}
        onClose={closeModal}
        title={selectedService?.isDisabled ? "Enable Service" : "Disable Service"}
      >
        {selectedService && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">
              {selectedService.isDisabled ? (
                <>Enable <strong>{serviceLabel(selectedService)}</strong>? Customers will be able to order it again.</>
              ) : (
                <>Disable <strong>{serviceLabel(selectedService)}</strong>? Customers will no longer be able to order it.</>
              )}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-muted transition">Cancel</button>
              <button
                type="button"
                onClick={handleToggleDisabled}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${selectedService.isDisabled ? "bg-accent hover:bg-accent-hover" : "bg-danger hover:bg-danger/90"}`}
              >
                {busy ? "Saving…" : selectedService.isDisabled ? "Enable Service" : "Disable Service"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === "delete"} onClose={closeModal} title="Delete Service">
        {selectedService && (
          <div className="space-y-4">
            {actionError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm">{actionError}</div>}
            <p className="text-sm">
              Are you sure you want to delete <strong>{serviceLabel(selectedService)}</strong> from{" "}
              <strong>{shopNameOf(selectedService, shops)}</strong>? This cannot be undone.
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
