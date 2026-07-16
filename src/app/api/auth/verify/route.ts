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

  const { code, number } = body as Record<string, unknown>;

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { success: false, error: "OTP code is required" },
      { status: 400 },
    );
  }

  if (typeof number !== "string" || !number.trim()) {
    return NextResponse.json(
      { success: false, error: "Number is required" },
      { status: 400 },
    );
  }

  const normalized = normalizePhoneNumber(number);

  try {
    const upstream = await fetch(backendUrl("/api/auth/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        number: normalized,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }
}
