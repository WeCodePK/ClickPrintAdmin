import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";
import type { CreateShopInput } from "@/lib/types";

function badRequest(message: string, details?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status: 400 },
  );
}

function parseCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
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

  if (!body || typeof body !== "object") {
    return badRequest("Request body must be an object");
  }

  const {
    name,
    address,
    coordinates,
    imageUrl,
    timings,
    walletNumber,
    capabilities,
    owner,
  } = body as Record<string, unknown>;

  const details: Record<string, string> = {};
  const parsedCoordinates = parseCoordinates(coordinates);

  if (typeof name !== "string" || !name.trim()) details.name = "Name is required";
  if (typeof address !== "string" || !address.trim()) {
    details.address = "Address is required";
  }
  if (!parsedCoordinates) {
    details.coordinates = "Coordinates must be [latitude, longitude]";
  }
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    details.imageUrl = "Image URL is required";
  }
  if (
    !Array.isArray(timings) ||
    timings.length === 0 ||
    timings.some((t) => typeof t !== "string" || !t.trim())
  ) {
    details.timings = "At least one timing string is required";
  }
  if (typeof walletNumber !== "string" || !walletNumber.trim()) {
    details.walletNumber = "Wallet number is required";
  }
  if (capabilities !== undefined && !Array.isArray(capabilities)) {
    details.capabilities = "Capabilities must be an array";
  }
  if (typeof owner !== "string" || !owner.trim()) {
    details.owner = "Owner id is required";
  }

  if (Object.keys(details).length > 0) {
    return badRequest("Validation failed", details);
  }

  const payload: CreateShopInput = {
    name: (name as string).trim(),
    address: (address as string).trim(),
    coordinates: parsedCoordinates!,
    imageUrl: (imageUrl as string).trim(),
    timings: (timings as string[]).map((t) => t.trim()),
    walletNumber: (walletNumber as string).trim(),
    capabilities: Array.isArray(capabilities)
      ? (capabilities as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : [],
    owner: (owner as string).trim(),
  };

  return proxyJson(request, "/api/shops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
