import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ shopId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { shopId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Request body must be an object" },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/owners/${shopId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
