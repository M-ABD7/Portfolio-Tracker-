import { NextResponse } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/auth-header";

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

    const res = NextResponse.json({ user: payload.user }, { status: 200 });
    res.cookies.set("auth_token", payload.access, AUTH_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend." },
      { status: 502 }
    );
  }
}
