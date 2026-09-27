import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Shop } from "./types";

/**
 * Standardizes a Pakistani or international phone number for WhatsApp wa.me links.
 * Example inputs: "03001234567", "+923001234567", "923001234567", "0300-1234567"
 * Output: "923001234567"
 */
export function formatWhatsAppNumber(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("03")) {
    return "92" + digits.slice(1);
  }
  if (digits.startsWith("3") && digits.length === 10) {
    return "92" + digits;
  }
  if (digits.startsWith("92")) {
    return digits;
  }
  return digits;
}

export function getWhatsAppUrl(phone?: string): string {
  const formatted = formatWhatsAppNumber(phone);
  return formatted ? `https://wa.me/${formatted}` : "https://wa.me";
}

export function getAppDownloadUrl(shopId: string): string {
  return `https://app.clickprint.pk?shopId=${encodeURIComponent(shopId)}`;
}

// Embedded SVG fallbacks for guaranteed offline / zero-network rendering
const APP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke="#101418" stroke-linecap="round" stroke-linejoin="round" stroke-width="15"><path fill="#efeff1" d="M120 168V15h272v153"/><rect width="496" height="268" x="8" y="172" fill="#474f54" rx="44"/><path fill="#32393f" stroke="none" d="M92 172H52a44 44 0 0 0-44 44v180a44 44 0 0 0 44 44h40a44 44 0 0 1-44-44V216a44 44 0 0 1 44-44"/><rect width="496" height="268" x="8" y="172" rx="44"/><circle cx="65" cy="237" r="23" fill="#4bcf9a"/><circle cx="146" cy="237" r="23" fill="#fc6e51"/><path fill="#32393f" d="M88 292h336v96H88z"/><path fill="#efeff1" d="M130 332h252l22 180H108z"/><path d="M116 332h280M170 375h172m-177 36h182m-187 36h192"/></g></svg>`;

const WHATSAPP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#25D366" d="M256.064 0h-.128C114.784 0 0 114.816 0 256c0 56 18.048 107.904 48.736 150.048l-31.904 95.68 98.656-31.328C155.68 497.504 204.096 512 256.064 512 397.28 512 512 397.184 512 256c0-141.184-114.72-256-255.936-256z"/><path fill="#FFFFFF" d="M405.024 361.504c-6.176 17.44-30.656 31.904-50.144 36.096-13.376 2.848-30.848 5.12-89.664-19.264-75.232-31.168-123.68-107.616-127.456-112.576-3.616-4.96-30.4-40.48-30.4-77.216s19.168-54.72 26-62.176c6.816-7.488 14.88-9.344 19.84-9.344 4.96 0 9.92.064 14.24.288 4.576.224 10.72-.864 16.736 13.568 6.208 14.88 21.184 51.68 23.04 55.424 1.856 3.744 3.104 8.128.608 13.088-2.464 4.96-3.712 8.064-7.424 12.416-3.744 4.352-7.872 9.728-11.232 13.088-3.744 3.744-7.648 7.808-3.296 15.264 4.352 7.456 19.36 31.968 41.536 51.68 28.576 25.44 52.672 33.312 60.128 37.056 7.456 3.744 11.808 3.104 16.16-1.856 4.352-4.96 18.624-21.728 23.584-29.184 4.96-7.456 9.92-6.208 16.736-3.744 6.816 2.496 43.424 20.48 50.88 24.224 7.456 3.744 12.416 5.568 14.272 8.672 1.856 3.104 1.856 18.016-4.32 35.456z"/></svg>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Generates a high-resolution QR code (Data URL) with an exact center logo overlay.
 * Error correction is set to High ('H' ~30% recovery capacity) to guarantee perfect scanning.
 */
export async function generateQrWithLogo(
  payload: string,
  logoType: "app" | "whatsapp",
  resolution = 800
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("generateQrWithLogo must be run in browser environment");
  }

  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;

  await QRCode.toCanvas(canvas, payload, {
    width: resolution,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Load logo image (try file first, fall back to embedded SVG)
  let logoImg: HTMLImageElement;
  try {
    const src = logoType === "app" ? "/app-logo.png" : "/whatsapp-logo.svg";
    logoImg = await loadImage(src);
  } catch {
    const fallbackSvg = logoType === "app" ? APP_LOGO_SVG : WHATSAPP_LOGO_SVG;
    const fallbackSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
    logoImg = await loadImage(fallbackSrc);
  }

  // Exact center calculation
  // Logo badge occupies ~22% of total QR width
  const logoSize = Math.round(resolution * 0.20);
  const padding = Math.round(logoSize * 0.14);
  const badgeSize = logoSize + padding * 2;
  const badgeX = (resolution - badgeSize) / 2;
  const badgeY = (resolution - badgeSize) / 2;
  const logoX = (resolution - logoSize) / 2;
  const logoY = (resolution - logoSize) / 2;
  const cornerRadius = Math.round(badgeSize * 0.24);

  // 1. Draw centered white background badge
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = Math.round(resolution * 0.015);
  ctx.shadowOffsetY = Math.round(resolution * 0.005);
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, cornerRadius);
  ctx.fill();
  ctx.restore();

  // 2. Subtle badge stroke
  ctx.save();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = Math.max(2, Math.round(resolution * 0.003));
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, cornerRadius);
  ctx.stroke();
  ctx.restore();

  // 3. Draw logo image centered
  ctx.save();
  if (logoType === "app") {
    // Round app logo corners nicely
    ctx.beginPath();
    ctx.roundRect(logoX, logoY, logoSize, logoSize, Math.round(cornerRadius * 0.7));
    ctx.clip();
  }
  ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

export interface DualQrData {
  appQrDataUrl: string;
  whatsappQrDataUrl: string;
  appUrl: string;
  whatsappUrl: string;
}

/**
 * Prepares both QR code data URLs and raw payloads for a given shop.
 */
export async function prepareDualQrCodes(shop: Shop): Promise<DualQrData> {
  const appUrl = getAppDownloadUrl(shop._id);
  const whatsappUrl = getWhatsAppUrl(shop.contactNumber);

  const [appQrDataUrl, whatsappQrDataUrl] = await Promise.all([
    generateQrWithLogo(appUrl, "app"),
    generateQrWithLogo(whatsappUrl, "whatsapp"),
  ]);

  return {
    appQrDataUrl,
    whatsappQrDataUrl,
    appUrl,
    whatsappUrl,
  };
}

/**
 * Renders the shared page chrome: background, border, brand banner, shop name,
 * address tagline, and footer. Returns the Y position after the divider line
 * so the caller can start placing card content there.
 */
function renderPageChrome(
  doc: jsPDF,
  shop: Shop,
  pageWidth: number,
  pageHeight: number,
  margin: number
): number {
  // Background base
  doc.setFillColor(252, 253, 254);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Outer framing border
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, 5, 5);

  // Decorative Top Brand Banner
  doc.setFillColor(0, 217, 163); // ClickPrint Brand Accent Color
  doc.roundedRect(margin, margin, pageWidth - margin * 2, 16, 5, 5, "F");
  // Fill the bottom corners of the header so only top corners are rounded
  doc.rect(margin, margin + 10, pageWidth - margin * 2, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CLICKPRINT OFFICIAL PARTNER SHOP", pageWidth / 2, margin + 11, { align: "center" });

  // Prominent Shop Name Header
  let currentY = margin + 30;
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");

  // Adjust font size dynamically for long shop names
  const shopName = shop.name || "Print Partner";
  if (shopName.length > 30) {
    doc.setFontSize(22);
  } else if (shopName.length > 20) {
    doc.setFontSize(26);
  } else {
    doc.setFontSize(30);
  }
  doc.text(shopName, pageWidth / 2, currentY, { align: "center" });

  // Address & Tagline
  currentY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const addressText = shop.address ? shop.address.substring(0, 75) : "Fast & Reliable Digital Printing Counter";
  doc.text(addressText, pageWidth / 2, currentY, { align: "center" });

  currentY += 5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin + 20, currentY, pageWidth - margin - 20, currentY);

  // Footer
  const footerY = pageHeight - margin - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Fast • Contactless • High Quality Printing — Powered by ClickPrint", pageWidth / 2, footerY, { align: "center" });

  return currentY;
}

/**
 * Generates and downloads a print-ready, high-resolution A4 PDF document
 * with each QR code on its own separate page, shop name header, and store display styling.
 */
export async function downloadShopSignagePdf(shop: Shop): Promise<void> {
  const qrData = await prepareDualQrCodes(shop);

  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Card dimensions (now larger since each card gets a full page)
  const cardWidth = contentWidth - 20;
  const cardHeight = 170;
  const cardX = margin + 10;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: App QR Code
  // ══════════════════════════════════════════════════════════════════════════
  let currentY = renderPageChrome(doc, shop, pageWidth, pageHeight, margin);
  currentY += 12;
  const cardY1 = currentY;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.roundedRect(cardX, cardY1, cardWidth, cardHeight, 6, 6, "FD");

  // Top accent bar (ClickPrint Emerald)
  doc.setFillColor(0, 217, 163);
  doc.roundedRect(cardX, cardY1, cardWidth, 6, 6, 6, "F");
  doc.rect(cardX, cardY1 + 3, cardWidth, 3, "F");

  // Header Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Use this to install our app", cardX + cardWidth / 2, cardY1 + 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan to upload & order prints directly", cardX + cardWidth / 2, cardY1 + 28, { align: "center" });

  // App QR Image (larger since it has the full page)
  const qrSize = 100;
  const qrX1 = cardX + (cardWidth - qrSize) / 2;
  const qrY1 = cardY1 + 35;
  doc.addImage(qrData.appQrDataUrl, "PNG", qrX1, qrY1, qrSize, qrSize);

  // Badge below App QR
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(cardX + 20, cardY1 + 140, cardWidth - 40, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Open Phone Camera & Scan", cardX + cardWidth / 2, cardY1 + 149, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("app.clickprint.pk", cardX + cardWidth / 2, cardY1 + 163, { align: "center" });

  // Instructions Banner (Page 1)
  const stepsY1 = cardY1 + cardHeight + 12;
  const stepsBoxWidth = contentWidth - 20;
  const stepsBoxX = margin + 10;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(stepsBoxX, stepsY1, stepsBoxWidth, 34, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("HOW TO PRINT INSTANTLY", stepsBoxX + stepsBoxWidth / 2, stepsY1 + 9, { align: "center" });

  const colW = stepsBoxWidth / 3;
  const stepItems = [
    { num: "1", title: "Scan App QR", desc: "Open camera & scan" },
    { num: "2", title: "Upload Files", desc: "Select PDF or images" },
    { num: "3", title: "Collect Prints", desc: "Get copies instantly" },
  ];

  stepItems.forEach((item, idx) => {
    const colCenter = stepsBoxX + colW * idx + colW / 2;
    doc.setFillColor(0, 217, 163);
    doc.circle(colCenter - 22, stepsY1 + 20, 3.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(item.num, colCenter - 22, stepsY1 + 21.2, { align: "center" });

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(item.title, colCenter - 14, stepsY1 + 19, { align: "left" });

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(item.desc, colCenter - 14, stepsY1 + 25, { align: "left" });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: WhatsApp QR Code
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  currentY = renderPageChrome(doc, shop, pageWidth, pageHeight, margin);
  currentY += 12;
  const cardY2 = currentY;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.roundedRect(cardX, cardY2, cardWidth, cardHeight, 6, 6, "FD");

  // Top accent bar (WhatsApp Green #25D366)
  doc.setFillColor(37, 211, 102);
  doc.roundedRect(cardX, cardY2, cardWidth, 6, 6, 6, "F");
  doc.rect(cardX, cardY2 + 3, cardWidth, 3, "F");

  // Header Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Use to send on WhatsApp", cardX + cardWidth / 2, cardY2 + 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan to chat & send files on WhatsApp", cardX + cardWidth / 2, cardY2 + 28, { align: "center" });

  // WhatsApp QR Image (larger since it has the full page)
  const qrX2 = cardX + (cardWidth - qrSize) / 2;
  const qrY2 = cardY2 + 35;
  doc.addImage(qrData.whatsappQrDataUrl, "PNG", qrX2, qrY2, qrSize, qrSize);

  // Badge below WhatsApp QR
  doc.setFillColor(240, 253, 244); // light green bg
  doc.roundedRect(cardX + 20, cardY2 + 140, cardWidth - 40, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(shop.contactNumber ? `WhatsApp: ${shop.contactNumber}` : "WhatsApp Chat Link", cardX + cardWidth / 2, cardY2 + 149, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const waDisplay = qrData.whatsappUrl.replace(/^https?:\/\//, "");
  doc.text(waDisplay, cardX + cardWidth / 2, cardY2 + 163, { align: "center" });

  // Instructions Banner (Page 2 — WhatsApp-specific steps)
  const stepsY2 = cardY2 + cardHeight + 12;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(stepsBoxX, stepsY2, stepsBoxWidth, 34, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("HOW TO SEND VIA WHATSAPP", stepsBoxX + stepsBoxWidth / 2, stepsY2 + 9, { align: "center" });

  const waStepItems = [
    { num: "1", title: "Scan WhatsApp QR", desc: "Open camera & scan" },
    { num: "2", title: "Send Your Files", desc: "Share PDFs or photos" },
    { num: "3", title: "Collect Prints", desc: "Get copies instantly" },
  ];

  waStepItems.forEach((item, idx) => {
    const colCenter = stepsBoxX + colW * idx + colW / 2;
    doc.setFillColor(37, 211, 102);
    doc.circle(colCenter - 22, stepsY2 + 20, 3.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(item.num, colCenter - 22, stepsY2 + 21.2, { align: "center" });

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(item.title, colCenter - 14, stepsY2 + 19, { align: "left" });

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(item.desc, colCenter - 14, stepsY2 + 25, { align: "left" });
  });

  // Safe filename
  const cleanShopName = (shop.name || "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`${cleanShopName}-dual-qr-signage.pdf`);
}
