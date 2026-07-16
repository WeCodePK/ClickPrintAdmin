import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/proxy";

type RouteContext = {
  params: Promise<{ topupId: string }>;
};


export async function PATCH(request: Request, context: RouteContext) {
  const { topupId } = await context.params;

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

  const raw = body as Record<string, unknown>;

  // Accept either the UI-friendly action or the backend status field
  let status: "approved" | "declined" | null = null;

  if (raw.status === "approved" || raw.status === "declined") {
    status = raw.status;
  } else if (raw.action === "approve") {
    status = "approved";
  } else if (raw.action === "decline") {
    status = "declined";
  } else if (raw.action === "approved") {
    status = "approved";
  } else if (raw.action === "declined") {
    status = "declined";
  }

  if (!status) {
    return NextResponse.json(
      {
        success: false,
        error: 'status must be "approved" or "declined"',
      },
      { status: 400 },
    );
  }

  return proxyJson(request, `/api/topups/${topupId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { topupId } = await context.params;
  return proxyJson(request, `/api/topups/${topupId}`, { method: "DELETE" });
}
