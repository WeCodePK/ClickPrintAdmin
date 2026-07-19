import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ shopId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  return proxyJson(request, `/api/history/${shopId}`);
}
