export function jsonServerError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[api] server error:", message, error);
  return Response.json(
    {
      error: message,
      stack: process.env.NODE_ENV !== "production" ? stack : undefined,
    },
    { status }
  );
}
