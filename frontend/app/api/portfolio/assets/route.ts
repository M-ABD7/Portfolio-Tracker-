import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_API_BASE_URL}/portfolio/assets/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(request),
      },
      body: JSON.stringify(body),
      cache: "no-store",
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
          "Unable to save the asset because the Django backend is not reachable on http://127.0.0.1:8000.",
      },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  const incomingUrl = new URL(request.url);
  // holdingId is sent as the last URL path segment: /api/portfolio/assets/<id>/
  const segments = incomingUrl.pathname.split("/").filter(Boolean);
  const holdingId = segments[segments.length - 1] || null;

  if (!holdingId) {
    return NextResponse.json({ error: "holdingId is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_API_BASE_URL}/portfolio/assets/${holdingId}/`, {
      method: "DELETE",
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
          "Unable to delete the asset because the Django backend is not reachable on http://127.0.0.1:8000.",
      },
      { status: 502 }
    );
  }
}
