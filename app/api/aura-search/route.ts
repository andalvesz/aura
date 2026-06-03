import { runGlobalSearch } from "@/lib/supabase/services/global-search.service";
import type { GlobalSearchFilter } from "@/utils/global-search";

const VALID_FILTERS = new Set<GlobalSearchFilter>([
  "todos",
  "leads",
  "eventos",
  "conteudo",
  "saude",
  "financeiro",
  "ia",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const rawFilter = searchParams.get("filter") ?? "todos";
    const filter = VALID_FILTERS.has(rawFilter as GlobalSearchFilter)
      ? (rawFilter as GlobalSearchFilter)
      : "todos";
    const page = Math.max(0, Number(searchParams.get("page") ?? "0") || 0);

    const { results, total, hasMore, error } = await runGlobalSearch(q, {
      filter,
      page,
    });

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 400;
      return Response.json({ error, results: [], total: 0, hasMore: false }, { status });
    }

    return Response.json({ results, total, hasMore, query: q, filter, page });
  } catch (error) {
    console.error("[aura-search]", error);
    return Response.json(
      { error: "Erro na busca global.", results: [], total: 0, hasMore: false },
      { status: 500 }
    );
  }
}
