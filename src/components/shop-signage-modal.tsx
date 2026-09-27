"use client";

import { useEffect, useState } from "react";
import type { Shop } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import {
  prepareDualQrCodes,
  downloadShopSignagePdf,
  type DualQrData,
} from "@/lib/shop-signage";

interface ShopSignageModalProps {
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShopSignageModal({ shop, isOpen, onClose }: ShopSignageModalProps) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrData, setQrData] = useState<DualQrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"app" | "wa" | null>(null);

  useEffect(() => {
    if (!isOpen || !shop) {
      setQrData(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    prepareDualQrCodes(shop)
      .then((data) => {
        if (active) setQrData(data);
      })
      .catch((err) => {
        console.error("Failed to generate QR codes:", err);
        if (active) setError("Could not render QR codes. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, shop]);

  const handleDownloadPdf = async () => {
    if (!shop) return;
    try {
      setDownloading(true);
      setError(null);
      await downloadShopSignagePdf(shop);
    } catch (err) {
      console.error("Error generating signage PDF:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async (text: string, type: "app" | "wa") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Partner Shop QR Signage" size="xl">
      {shop && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                <h3 className="font-display text-xl font-bold text-foreground">
                  {shop.name}
                </h3>
              </div>
              <p className="text-xs text-muted mt-1">
                {shop.address || "Digital Print Point"} • Contact: {shop.contactNumber || "N/A"}
              </p>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading || loading || !qrData}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generating PDF…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Printable PDF (A4)
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger border border-danger/20">
              {error}
            </div>
          )}

          {/* Printable Preview Sheet */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-5">
            <div className="text-center mb-5">
              <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                Signage Preview
              </span>
              <h4 className="mt-1 text-base font-semibold text-foreground">
                In-Store Dual QR Code Display
              </h4>
              <p className="text-xs text-muted">
                High-resolution ready with exact centered branding logos for counter or wall display.
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted">
                <svg className="h-8 w-8 animate-spin text-accent mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm">Generating QR codes with logo overlays…</p>
              </div>
            ) : qrData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. App QR Card */}
                <div className="rounded-xl border border-border bg-surface p-5 shadow-sm flex flex-col items-center text-center">
                  <div className="mb-2">
                    <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                      Section 1: App Installation
                    </span>
                  </div>
                  <h5 className="font-semibold text-foreground text-sm">
                    &quot;Use this to install our app&quot;
                  </h5>
                  <p className="text-xs text-muted mb-3">
                    Directs customers to download & selects this shop
                  </p>

                  <div className="rounded-xl border border-border/80 bg-white p-3 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrData.appQrDataUrl}
                      alt="App QR Code"
                      className="h-44 w-44 object-contain"
                    />
                  </div>

                  <div className="mt-3 w-full space-y-2">
                    <p className="text-[11px] font-mono text-muted truncate bg-surface-muted px-2 py-1 rounded">
                      {qrData.appUrl}
                    </p>
                    <button
                      onClick={() => handleCopyLink(qrData.appUrl, "app")}
                      className="w-full text-xs font-medium rounded-md border border-border py-1.5 hover:bg-surface-muted transition flex items-center justify-center gap-1.5"
                    >
                      {copiedType === "app" ? (
                        <>
                          <span className="text-accent font-semibold">✓ Copied App URL</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          Copy App URL
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. WhatsApp QR Card */}
                <div className="rounded-xl border border-border bg-surface p-5 shadow-sm flex flex-col items-center text-center">
                  <div className="mb-2">
                    <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      Section 2: WhatsApp Chat
                    </span>
                  </div>
                  <h5 className="font-semibold text-foreground text-sm">
                    &quot;Use to send on WhatsApp&quot;
                  </h5>
                  <p className="text-xs text-muted mb-3">
                    Directs customers to message counter staff
                  </p>

                  <div className="rounded-xl border border-border/80 bg-white p-3 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrData.whatsappQrDataUrl}
                      alt="WhatsApp QR Code"
                      className="h-44 w-44 object-contain"
                    />
                  </div>

                  <div className="mt-3 w-full space-y-2">
                    <p className="text-[11px] font-mono text-muted truncate bg-surface-muted px-2 py-1 rounded">
                      {qrData.whatsappUrl}
                    </p>
                    <button
                      onClick={() => handleCopyLink(qrData.whatsappUrl, "wa")}
                      className="w-full text-xs font-medium rounded-md border border-border py-1.5 hover:bg-surface-muted transition flex items-center justify-center gap-1.5"
                    >
                      {copiedType === "wa" ? (
                        <>
                          <span className="text-emerald-600 font-semibold">✓ Copied WhatsApp Link</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          Copy WhatsApp Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted">
              PDF exports in 300+ DPI suitable for A4 or US Letter color printing & laminating.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading || loading || !qrData}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover transition disabled:opacity-50 flex items-center gap-2"
              >
                {downloading ? "Exporting…" : "Download PDF Signage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
