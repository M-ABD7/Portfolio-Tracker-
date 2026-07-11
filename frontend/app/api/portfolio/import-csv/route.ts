import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL = process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export const dynamic = "force-dynamic";

// Not using lib/server-proxy.ts::proxyBackend here — it forces
// Content-Type: application/json and reads the body via request.text(),
// which would corrupt a multipart file upload. This forwards the raw
// multipart body (with its original boundary) untouched instead.
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    const body = await request.arrayBuffer();
    const response = await fetch(`${BACKEND_API_BASE_URL}/portfolio/import/csv/`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...getAuthHeader(request),
      },
      body,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const res = NextResponse.json(
        { error: (payload && (payload.error || payload.detail)) || `Backend request failed with status ${response.status}.` },
        { status: response.status }
      );
      if (response.status === 401) {
        res.cookies.delete("auth_token");
      }
      return res;
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend. Make sure runserver is active on http://127.0.0.1:8000." },
      { status: 502 }
    );
  }
}
