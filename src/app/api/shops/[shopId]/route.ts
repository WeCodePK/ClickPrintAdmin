import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/proxy";

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
  return proxyJson(req, `/api/shops/${shopId}`, {
    method: "PUT",
    body: req.body,
    duplex: "half"
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;
  return proxyJson(req, `/api/shops/${shopId}`, { method: "DELETE" });
}
