import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyJson(req, `/api/users/${userId}`, { 
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
