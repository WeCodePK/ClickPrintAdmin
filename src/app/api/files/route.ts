import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/api-config";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected a multipart/form-data body" },
      { status: 400 },
    );
  }

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "A file is required in the 'file' field" },
      { status: 400 },
    );
  }

  // Rebuild the form so fetch sets a fresh multipart boundary.
  const outgoing = new FormData();
  outgoing.append("file", file, file.name);
  outgoing.append("convert", String(incoming.get("convert") ?? "false"));

  try {
    const upstream = await fetch(backendUrl("/api/files"), {
      method: "POST",
      headers: authHeader ? { Authorization: authHeader } : {},
      body: outgoing,
    });

    const raw = await upstream.text();
    let data: unknown = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { success: false, error: raw || "Non-JSON response from backend" };
    }

    if (!upstream.ok) {
      console.error("[POST /api/files] upstream error", {
        status: upstream.status,
        body: data,
      });
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";
    console.error("[POST /api/files] proxy failure", message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
