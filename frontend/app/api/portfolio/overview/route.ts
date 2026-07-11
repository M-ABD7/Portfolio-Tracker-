import { proxyBackend } from "@/lib/server-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyBackend(request, "/portfolio/overview/");
}
