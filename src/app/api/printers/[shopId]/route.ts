import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ shopId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  return proxyJson(request, `/api/printers/${shopId}`);
}

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { name } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { success: false, error: "name is required" },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/printers/${shopId}`, {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  });
}
