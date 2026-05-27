/** Extract the auth token from the incoming request's Cookie header. */
export function getAuthHeader(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Build the Set-Cookie string that stores the auth token (HttpOnly). */
export function buildAuthCookie(
  token: string,
  maxAgeSeconds = 60 * 60 * 24 * 30  // 30 days
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `auth_token=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/** Build the Set-Cookie string that clears the auth token. */
export function clearAuthCookie(): string {
  return "auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax";
}
