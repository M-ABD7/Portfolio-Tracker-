import { NextResponse } from "next/server";
import { buildJWTCookie } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    const refreshToken = match ? match[1] : null;

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token." }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json({ error: "Token refresh failed." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", buildJWTCookie(payload.access));
    return res;
  } catch {
    return NextResponse.json({ error: "Unable to reach the backend." }, { status: 502 });
  }
}
