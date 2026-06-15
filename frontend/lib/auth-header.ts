/** Extract the auth token from the incoming request's Cookie header. */
export function getAuthHeader(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token || token === "undefined" || token === "null" || !token.trim()) return {};
  return { Authorization: `Token ${token}` };
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
} as const;
