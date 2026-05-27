import { proxyBackend } from "@/lib/server-proxy";

export async function GET(request: Request) {
  return proxyBackend(request, "/settings/");
}

export async function PUT(request: Request) {
  return proxyBackend(request, "/settings/");
}