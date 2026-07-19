import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  return proxyJson(request, `/api/drafts/${draftId}`);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  return proxyJson(request, `/api/drafts/${draftId}`, { method: "DELETE" });
}
