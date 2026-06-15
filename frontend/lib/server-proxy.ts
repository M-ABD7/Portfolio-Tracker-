import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL = process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof (payload as Record<string, unknown>).error === "string") {
    return (payload as Record<string, string>).error;
  }
  if (payload && typeof (payload as Record<string, unknown>).detail === "string") {
    return (payload as Record<string, string>).detail;
  }
  return `Backend request failed with status ${status}.`;
}

export async function proxyBackend(request: Request, targetPath: string) {
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_API_BASE_URL}${targetPath}${incomingUrl.search}`;

  try {
    const init: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(request),
      },
      cache: "no-store",
    };

    if (request.method !== "GET") {
      init.body = await request.text();
    }

    const response = await fetch(targetUrl, init);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const res = NextResponse.json(
        { error: errorMessage(payload, response.status) },
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