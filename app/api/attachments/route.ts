/**
 * Attachments library API — list / search.
 */

import {
  listMemoryAttachments,
  searchMemoryAttachments,
} from "@/lib/supabase/services/smart-capture.service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    if (q) {
      const hits = await searchMemoryAttachments(q);
      return Response.json({ hits, executionInfluence: "none" });
    }
    const attachments = await listMemoryAttachments();
    return Response.json({ attachments, executionInfluence: "none" });
  } catch (error) {
    console.error("[api/attachments]", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao listar anexos",
        attachments: [],
        hits: [],
      },
      { status: 500 }
    );
  }
}
