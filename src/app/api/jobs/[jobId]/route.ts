import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  return proxyJson(request, `/api/jobs/${jobId}`);
}
