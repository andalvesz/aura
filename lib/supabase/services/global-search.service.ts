import { getDataContext } from "@/lib/supabase/services/context";
import {
  buildSearchResult,
  entitiesForFilter,
  escapeIlikePattern,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PAGE_SIZE,
  GLOBAL_SEARCH_PER_TABLE,
  paginateSearchResults,
  sortSearchResults,
  type GlobalSearchEntity,
  type GlobalSearchFilter,
  type GlobalSearchResult,
} from "@/utils/global-search";

type SearchOptions = {
  filter?: GlobalSearchFilter;
  page?: number;
  limit?: number;
  perTable?: number;
};

function ilikeOr(columns: string[], pattern: string): string {
  return columns.map((col) => `${col}.ilike.${pattern}`).join(",");
}

async function searchTable(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  userId: string,
  entity: GlobalSearchEntity,
  pattern: string,
  perTable: number
): Promise<GlobalSearchResult[]> {
  const orFilter = (cols: string[]) => ilikeOr(cols, pattern);

  switch (entity) {
    case "growth_leads": {
      const { data } = await supabase
        .from("growth_leads")
        .select("id, nome, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["nome", "contato", "observacoes", "origem"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.nome,
          (r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "clientes": {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["nome", "telefone", "email", "instagram", "observacoes"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.nome,
          (r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "orcamentos": {
      const { data } = await supabase
        .from("orcamentos")
        .select("id, tipo_evento, local, created_at, updated_at, data_evento")
        .eq("user_id", userId)
        .or(orFilter(["tipo_evento", "local", "status", "observacoes"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.tipo_evento,
          (r.data_evento ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "eventos": {
      const { data } = await supabase
        .from("eventos")
        .select("id, titulo, data_inicio, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "descricao", "local", "tipo"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data_inicio ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "alvesz_eventos": {
      const { data } = await supabase
        .from("alvesz_eventos")
        .select("id, titulo, data_evento, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "local"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data_evento ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "conteudos": {
      const { data } = await supabase
        .from("conteudos")
        .select("id, titulo, data_publicacao, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "plataforma", "formato", "objetivo", "roteiro", "observacoes"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data_publicacao ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "health_habits": {
      const { data } = await supabase
        .from("health_habits")
        .select("id, titulo, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "frequencia", "status"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "health_workouts": {
      const { data } = await supabase
        .from("health_workouts")
        .select("id, nome, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["nome", "grupo_muscular", "observacoes"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.nome,
          (r.data ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "health_meals": {
      const { data } = await supabase
        .from("health_meals")
        .select("id, nome, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["nome", "alimentos", "observacoes"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.nome,
          (r.data ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "ai_messages": {
      const { data } = await supabase
        .from("ai_messages")
        .select("id, content, module, created_at")
        .eq("user_id", userId)
        .or(orFilter(["content", "module"]))
        .order("created_at", { ascending: false })
        .limit(perTable);
      return (data ?? []).map((r) => {
        const snippet = r.content.trim().slice(0, 80);
        const title = snippet.length < r.content.length ? `${snippet}…` : snippet;
        return buildSearchResult(entity, r.id, title || r.module, r.created_at.slice(0, 10));
      });
    }
    case "financial_income": {
      const { data } = await supabase
        .from("financial_income")
        .select("id, descricao, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["descricao", "origem"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.descricao,
          (r.data ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "gastos": {
      const { data } = await supabase
        .from("gastos")
        .select("id, titulo, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "categoria"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "financial_goals": {
      const { data } = await supabase
        .from("financial_goals")
        .select("id, titulo, data_fim, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.data_fim ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    default:
      return [];
  }
}

export async function runGlobalSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{
  results: GlobalSearchResult[];
  total: number;
  hasMore: boolean;
  error: string | null;
}> {
  const term = query.trim();
  if (term.length < GLOBAL_SEARCH_MIN_CHARS) {
    return {
      results: [],
      total: 0,
      hasMore: false,
      error: `Digite pelo menos ${GLOBAL_SEARCH_MIN_CHARS} caracteres.`,
    };
  }

  const ctx = await getDataContext().catch(() => null);
  if (!ctx) {
    return {
      results: [],
      total: 0,
      hasMore: false,
      error: "Usuário não autenticado.",
    };
  }

  const filter = options.filter ?? "todos";
  const page = Math.max(0, options.page ?? 0);
  const pageSize = options.limit ?? GLOBAL_SEARCH_PAGE_SIZE;
  const perTable = options.perTable ?? GLOBAL_SEARCH_PER_TABLE;
  const pattern = `%${escapeIlikePattern(term)}%`;

  const entities = entitiesForFilter(filter);

  const batches = await Promise.all(
    entities.map((entity) =>
      searchTable(ctx.supabase, ctx.userId, entity, pattern, perTable)
    )
  );

  const merged = sortSearchResults(batches.flat());
  const { slice, total, hasMore } = paginateSearchResults(merged, page, pageSize);

  return { results: slice, total, hasMore, error: null };
}
