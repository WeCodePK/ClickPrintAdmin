import { proxyJson } from "@/lib/proxy";

export async function GET(request: Request) {
  return proxyJson(request, "/api/services");
}
