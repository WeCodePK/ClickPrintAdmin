import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  return proxyJson(req, "/api/jobs");
}
