import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shopId: string; serviceId: string }> },
) {
  const { shopId, serviceId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { isDisabled } = (body ?? {}) as Record<string, unknown>;
  if (typeof isDisabled !== "boolean") {
    return NextResponse.json(
      { success: false, error: "isDisabled must be a boolean" },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/services/${shopId}/${serviceId}/isDisabled`, {
    method: "PATCH",
    body: JSON.stringify({ isDisabled }),
  });
}
