import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";
import { parseServicePayload } from "@/lib/service-payload";

type RouteContext = {
  params: Promise<{ shopId: string; serviceId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { shopId, serviceId } = await context.params;
  return proxyJson(request, `/api/services/${shopId}/${serviceId}`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { shopId, serviceId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // An update takes the same body as a create.
  const { payload, details } = parseServicePayload(body);
  if (details) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/services/${shopId}/${serviceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { shopId, serviceId } = await context.params;
  return proxyJson(request, `/api/services/${shopId}/${serviceId}`, {
    method: "DELETE",
  });
}
