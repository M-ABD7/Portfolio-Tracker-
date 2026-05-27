import { proxyBackend } from "@/lib/server-proxy";

export async function GET(request: Request) {
  return proxyBackend(request, "/security/two-factor/");
}

export async function POST(request: Request) {
  return proxyBackend(request, "/security/two-factor/");
}

export async function DELETE(request: Request) {
  return proxyBackend(request, "/security/two-factor/");
}