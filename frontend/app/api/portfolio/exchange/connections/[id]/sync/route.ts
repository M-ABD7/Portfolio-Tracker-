import { proxyBackend } from "@/lib/server-proxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackend(request, `/exchange/connections/${id}/sync/`);
}
