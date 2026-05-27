import { NextResponse } from "next/server";
import { buildAuthCookie } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_API_BASE_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? `Login failed with status ${response.status}.` },
        { status: response.status }
      );
    }

    // Store raw token in HttpOnly cookie — never send it to the browser in JSON
    const res = NextResponse.json({ user: payload.user }, { status: 200 });
    res.headers.set("Set-Cookie", buildAuthCookie(payload.token));
    return res;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend." },
      { status: 502 }
    );
  }
}
