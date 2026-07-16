import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  return proxyJson(req, "/api/users");
}

export async function POST(req: NextRequest) {
  return proxyJson(req, "/api/users", {
    method: "POST",
    body: req.body,
    duplex: "half"
  });
}
