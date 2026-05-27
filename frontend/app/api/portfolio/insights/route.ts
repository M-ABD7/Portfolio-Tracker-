import { proxyBackend } from "@/lib/server-proxy";

export async function GET(request: Request) {
  return proxyBackend(request, "/portfolio/insights/");
}
