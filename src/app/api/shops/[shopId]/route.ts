import { NextRequest, NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";
import { parseShopPayload } from "@/lib/shop-payload";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;
  return proxyJson(req, `/api/shops/${shopId}`);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // An update takes the same body as a create.
  const { payload, details } = parseShopPayload(body);
  if (details) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details },
      { status: 400 },
    );
  }

  return proxyJson(req, `/api/shops/${shopId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;
  return proxyJson(req, `/api/shops/${shopId}`, { method: "DELETE" });
}
