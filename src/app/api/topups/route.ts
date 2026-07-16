import { proxyJson } from "@/lib/proxy";

/** Proxies GET {{host}}/api/topups */
export async function GET(request: Request) {
  return proxyJson(request, "/api/topups");
}
