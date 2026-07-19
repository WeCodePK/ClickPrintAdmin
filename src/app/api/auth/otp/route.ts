import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api-config";
import { normalizePhoneNumber } from "@/lib/auth-utils";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Request body must be an object" },
      { status: 400 },
    );
  }

  const { number } = body as Record<string, unknown>;

  if (typeof number !== "string" || !number.trim()) {
    return NextResponse.json(
      { success: false, error: "Number is required" },
      { status: 400 },
    );
  }

  const normalized = normalizePhoneNumber(number);
  if (normalized.length < 12) {
    return NextResponse.json(
      { success: false, error: "Enter a valid phone number" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(backendUrl("/api/auth/otp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: normalized,
        intent : "admin"
      }),
    });

    const raw = await upstream.text();
    const data = await upstream.json().catch(() => ({}));
    console.log("backend response", {
      status: upstream.status,
      body: raw
    })
    return NextResponse.json(
      {
        ...data,
        normalizedNumber: normalized,
      },
      { status: upstream.status },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend";
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }
}
