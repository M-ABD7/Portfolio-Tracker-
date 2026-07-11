import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/portfolio",
  "/add-assets",
  "/analytics",
  "/ai-suggestions",
  "/signal-allocation",
  "/transactions",
  "/settings",
  "/onboarding",
  "/admin-panel",
];

const AUTH_PATHS = ["/login", "/signup"];

const PUBLIC_PATHS = ["/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get("auth_token")?.value;
  const token =
    rawToken && rawToken !== "undefined" && rawToken !== "null" && rawToken.trim()
      ? rawToken
      : undefined;

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p);

  if (isPublic) {
    return NextResponse.next();
  }

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude static assets, image optimization, and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
