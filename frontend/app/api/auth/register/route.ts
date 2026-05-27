import { NextResponse } from "next/server";
import { buildAuthCookie } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_API_BASE_URL}/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // DRF validation errors arrive as { field: [msg, ...], ... } — flatten them
      const errorMsg =
        payload?.error ??
        (payload
          ? Object.values(payload as Record<string, string[]>)
              .flat()
              .join(" ")
          : null) ??
        `Registration failed (${response.status}).`;
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const res = NextResponse.json({ user: payload.user }, { status: 201 });
    res.headers.set("Set-Cookie", buildAuthCookie(payload.access));
    return res;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend." },
      { status: 502 }
    );
  }
}
