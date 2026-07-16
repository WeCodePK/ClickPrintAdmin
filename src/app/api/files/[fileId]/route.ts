import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api-config";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const authHeader = request.headers.get("authorization") || (queryToken ? `Bearer ${queryToken}` : null);

  try {
    const upstream = await fetch(backendUrl(`/api/files/${fileId}`), {
      headers: authHeader ? { Authorization: authHeader } : {},
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    let contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const upstreamDisposition = upstream.headers.get("content-disposition") || "";
    const name = url.searchParams.get("name") || fileId;

    // The backend converts missing skipConversion uploads to PDF and sets filename="...pdf"
    if (upstreamDisposition.toLowerCase().includes(".pdf")) {
      contentType = "application/pdf";
    } else if (contentType === "application/octet-stream" && name) {
      const lower = name.toLowerCase();
      if (lower.endsWith(".png")) contentType = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (lower.endsWith(".pdf")) contentType = "application/pdf";
      else if (lower.endsWith(".webp")) contentType = "image/webp";
      else if (lower.endsWith(".heic")) contentType = "image/heic";
      else contentType = "image/jpeg"; // default fallback for payment proofs
    }

    const buffer = await upstream.arrayBuffer();

    // Use the backend's disposition filename if available and it differs, or our name
    const finalName = upstreamDisposition.includes(".pdf") ? `${fileId}.pdf` : name;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${finalName}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch file";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
