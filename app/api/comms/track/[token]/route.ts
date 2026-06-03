import { markCommunicationOpened } from "@/lib/comms";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (token?.trim()) {
      await markCommunicationOpened(token.trim());
    }
  } catch {
    /* tracking must not fail visibly */
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
