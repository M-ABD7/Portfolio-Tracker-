import { NextResponse } from "next/server";
import { getAuthHeader } from "@/lib/auth-header";

const BACKEND_API_BASE_URL =
  process.env.DJANGO_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${BACKEND_API_BASE_URL}/wallets/`, {
      headers: { ...getAuthHeader(request) },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Unable to reach the backend." }, { status: 502 });
  }
}
