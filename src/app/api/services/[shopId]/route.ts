import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";
import { parseServicePayload } from "@/lib/service-payload";

type RouteContext = {
  params: Promise<{ shopId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  return proxyJson(request, `/api/services/${shopId}`);
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

  const { payload, details } = parseServicePayload(body);
  if (details) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/services/${shopId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
