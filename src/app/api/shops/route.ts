import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";
import { parseShopPayload } from "@/lib/shop-payload";

function badRequest(message: string, details?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const response = await proxyJson(request, "/api/shops");

  // Help diagnose empty lists vs parse issues in dev
  try {
    const clone = response.clone();
    const body = await clone.json();
    const shops = body?.data?.shops ?? body?.shops ?? body?.data;
    const count = Array.isArray(shops) ? shops.length : null;
    console.log("[GET /api/shops] upstream ok", {
      status: response.status,
      success: body?.success,
      shopCount: count,
      keys: body && typeof body === "object" ? Object.keys(body) : [],
      dataKeys:
        body?.data && typeof body.data === "object"
          ? Object.keys(body.data)
          : [],
    });
  } catch {
    // ignore logging failures
  }

  return response;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { payload, details } = parseShopPayload(body);
  if (details) {
    return badRequest("Validation failed", details);
  }

  return proxyJson(request, "/api/shops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
