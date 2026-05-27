import { NextResponse } from "next/server";
import { getAuthHeader, clearAuthCookie } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function DELETE(request: Request) {
  const authHeader = getAuthHeader(request);

  if (!authHeader.Authorization) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const response = await fetch(`${BACKEND_API_BASE_URL}/auth/delete/`, {
      method: "DELETE",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? "Failed to delete account." },
        { status: response.status }
      );
    }

    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set("Set-Cookie", clearAuthCookie());
    return res;
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the Django backend." },
      { status: 502 }
    );
  }
}
