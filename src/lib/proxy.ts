import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api-config";

type ProxyInit = RequestInit & { duplex?: "half" };

async function proxyJson(request: Request, path: string, init?: ProxyInit) {
  const authHeader = request.headers.get("authorization");

  try {
    const upstream = await fetch(backendUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(init?.headers ?? {}),
      },
    } as RequestInit);

    const raw = await upstream.text();
    let data: unknown = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { success: false, error: raw || "Non-JSON response from backend" };
    }

    if (!upstream.ok) {
      console.error(`[${init?.method ?? "GET"} ${path}] upstream error`, {
        status: upstream.status,
        body: data,
      });
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";
    console.error(`[${init?.method ?? "GET"} ${path}] proxy failure`, message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    );
  }
}

export { proxyJson };