type JsonRouteHandler = (request: Request) => Promise<Response> | Response;

export function jsonRouteError(module: string, error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;
  console.error(`[${module}] error`, { message, stack });
  return Response.json({ success: false, error: message }, { status });
}

export function withJsonRoute(module: string, handler: JsonRouteHandler): JsonRouteHandler {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return jsonRouteError(module, error);
    }
  };
}
