import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyJson(req, `/api/users/${userId}`);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyJson(req, `/api/users/${userId}`, {
    method: "PUT",
    body: req.body,
    duplex: "half"
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyJson(req, `/api/users/${userId}/isDisabled`, {
    method: "PATCH",
    body: req.body,
    duplex: "half"
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyJson(req, `/api/users/${userId}`, { method: "DELETE" });
}
