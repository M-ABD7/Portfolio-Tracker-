import { proxyBackend } from "@/lib/server-proxy";

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { connectionId } = await context.params;
  return proxyBackend(request, `/connections/${connectionId}/`);
}