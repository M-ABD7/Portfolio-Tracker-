import { NextResponse } from "next/server";
import { getAuthHeader, clearAuthCookie } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function POST(request: Request) {
  const authHeader = getAuthHeader(request);

  // Always clear the cookie, even if the backend call fails
  if (authHeader.Authorization) {
    try {
      await fetch(`${BACKEND_API_BASE_URL}/auth/logout/`, {
        method: "POST",
        headers: { ...authHeader },
        cache: "no-store",
      });
    } catch {
      // Intentionally swallowed — cookie is cleared regardless
    }
  }

  const res = NextResponse.json({ message: "Logged out." }, { status: 200 });
  res.headers.set("Set-Cookie", clearAuthCookie());
  return res;
}
