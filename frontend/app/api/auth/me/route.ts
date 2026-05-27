import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function GET(request: Request) {
  const authHeader = getAuthHeader(request);

  if (!authHeader.Authorization) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_API_BASE_URL}/auth/me/`, {
      headers: { ...authHeader },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? "Failed to fetch user." },
        { status: response.status }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend." },
      { status: 502 }
    );
  }
}
