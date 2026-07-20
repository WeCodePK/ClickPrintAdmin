import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ shopId: string; userId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { shopId, userId } = await context.params;
  return proxyJson(request, `/api/owners/${shopId}/${userId}`, {
    method: "DELETE",
  });
}
