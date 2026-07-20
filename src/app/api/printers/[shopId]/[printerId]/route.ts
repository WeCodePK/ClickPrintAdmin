import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ shopId: string; printerId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { shopId, printerId } = await context.params;
  return proxyJson(request, `/api/printers/${shopId}/${printerId}`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { shopId, printerId } = await context.params;

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

  return proxyJson(request, `/api/printers/${shopId}/${printerId}`, {
    method: "PUT",
    body: JSON.stringify({ name: name.trim() }),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { shopId, printerId } = await context.params;
  return proxyJson(request, `/api/printers/${shopId}/${printerId}`, {
    method: "DELETE",
  });
}
