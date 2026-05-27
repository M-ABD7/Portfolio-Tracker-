import { proxyBackend } from "@/lib/server-proxy";

export async function POST(request: Request) {
  return proxyBackend(request, "/portfolio/transfer/");
}
