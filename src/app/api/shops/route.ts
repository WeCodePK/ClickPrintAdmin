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

const TIMING_PATTERN =
  /^(?:Closed|(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d)$/;

/** Exactly 7 entries, Monday first, each "HH:MM-HH:MM" or "Closed". */
function isValidTimings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 7 &&
    value.every((t) => typeof t === "string" && TIMING_PATTERN.test(t.trim()))
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

  if (!body || typeof body !== "object") {
    return badRequest("Request body must be an object");
  }

  const {
    name,
    address,
    coordinates,
    imageFile,
    timings,
    contactNumber,
    googleMapsLink,
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
  if (typeof imageFile !== "string" || !imageFile.trim()) {
    details.imageFile = "An uploaded image file id is required";
  }
  if (!isValidTimings(timings)) {
    details.timings =
      'Timings must be 7 entries of "HH:MM-HH:MM" or "Closed", Monday first';
  }
  if (typeof contactNumber !== "string" || !contactNumber.trim()) {
    details.contactNumber = "Contact number is required";
  }
  if (
    googleMapsLink !== undefined &&
    (typeof googleMapsLink !== "string" ||
      (googleMapsLink.trim() && !/^https?:\/\//i.test(googleMapsLink.trim())))
  ) {
    details.googleMapsLink = "Google Maps link must be a valid http(s) URL";
  }

  if (Object.keys(details).length > 0) {
    return badRequest("Validation failed", details);
  }

  const trimmedLink =
    typeof googleMapsLink === "string" ? googleMapsLink.trim() : "";

  const payload: CreateShopInput = {
    name: (name as string).trim(),
    address: (address as string).trim(),
    coordinates: parsedCoordinates!,
    imageFile: (imageFile as string).trim(),
    timings: (timings as string[]).map((t) => t.trim()),
    contactNumber: (contactNumber as string).trim(),
    ...(trimmedLink ? { googleMapsLink: trimmedLink } : {}),
  };

  return proxyJson(request, "/api/shops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
