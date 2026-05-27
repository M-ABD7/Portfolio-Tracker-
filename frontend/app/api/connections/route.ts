import { proxyBackend } from "@/lib/server-proxy";

export async function GET(request: Request) {
  return proxyBackend(request, "/connections/");
}

export async function POST(request: Request) {
  return proxyBackend(request, "/connections/");
}