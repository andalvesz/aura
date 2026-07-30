/**
 * Link preview endpoint.
 */

import { fetchLinkPreview } from "@/lib/smart-capture/link-preview";
import { isHttpUrl } from "@/lib/smart-capture/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim() ?? "";
    if (!isHttpUrl(url)) {
      return Response.json({ error: "URL inválida" }, { status: 400 });
    }
    const preview = await fetchLinkPreview(url);
    return Response.json({ ok: true, preview, executionInfluence: "none" });
  } catch (error) {
    console.error("[api/smart-capture/link-preview]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Preview falhou" },
      { status: 500 }
    );
  }
}
