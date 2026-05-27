import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_API_BASE_URL}/portfolio/analytics/${incomingUrl.search}`;

  try {
    const response = await fetch(targetUrl, {
      cache: "no-store",
      headers: { ...getAuthHeader(request) },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload && typeof payload.error === "string"
              ? payload.error
              : `Backend request failed with status ${response.status}.`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to reach the Django backend. Make sure runserver is active on http://127.0.0.1:8000.",
      },
      { status: 502 }
    );
  }
}
