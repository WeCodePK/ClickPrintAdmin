import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function GET(request: Request) {
  return proxyJson(request, "/api/admins");
}

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

  return proxyJson(request, "/api/admins", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
