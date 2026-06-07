import { listAuraMemories } from "@/lib/supabase/services/ai-memories.service";
import type { AiMemoryCategoria } from "@/types/database";

const VALID_CATEGORIAS = new Set<AiMemoryCategoria>([
  "coach",
  "mentor",
  "calendario",
  "financeiro",
  "saude",
  "alvesz",
  "crescimento",
  "social_media",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCategoria = searchParams.get("categoria") ?? "all";
    const categoria = VALID_CATEGORIAS.has(rawCategoria as AiMemoryCategoria)
      ? (rawCategoria as AiMemoryCategoria)
      : "all";
    const from = searchParams.get("from")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || undefined;
    const q = searchParams.get("q")?.trim() || undefined;

    const { memories, error } = await listAuraMemories({
      categoria,
      from,
      to,
      q,
      limit: 100,
    });

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error: "Não foi possível carregar memórias." }, { status: 500 });
    }

    return Response.json({ memories, total: memories.length });
  } catch (err) {
    console.error("[memory]", err);
    return Response.json({ error: "Erro ao carregar memórias." }, { status: 500 });
  }
}
