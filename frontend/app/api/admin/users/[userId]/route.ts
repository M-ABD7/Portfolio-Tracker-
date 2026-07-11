import { proxyBackend } from "@/lib/server-proxy";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  return proxyBackend(request, `/admin/users/${userId}/`);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  return proxyBackend(request, `/admin/users/${userId}/`);
}
