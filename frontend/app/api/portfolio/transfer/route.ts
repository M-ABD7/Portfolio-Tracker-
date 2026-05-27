import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_API_BASE_URL}/portfolio/transfer/`, {
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
          "Unable to transfer the asset because the Django backend is not reachable on http://127.0.0.1:8000.",
      },
      { status: 502 }
    );
  }
}
