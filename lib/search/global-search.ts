import { getDataContext } from "@/lib/supabase/services/context";
import { logSearchFailure } from "@/lib/logs/record";
import {
  buildSearchResult,
  entitiesForFilter,
  escapeIlikePattern,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PAGE_SIZE,
  GLOBAL_SEARCH_PER_TABLE,
  groupSearchResults,
  paginateSearchResults,
  sortSearchResults,
  type GlobalSearchEntity,
  type GlobalSearchFilter,
  type GlobalSearchGroup,
  type GlobalSearchResult,
} from "@/utils/global-search";

export type GlobalSearchOptions = {
  filter?: GlobalSearchFilter;
  page?: number;
  limit?: number;
  perTable?: number;
};

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  groups: GlobalSearchGroup[];
  total: number;
  hasMore: boolean;
  error: string | null;
};

function ilikeOr(columns: string[], pattern: string): string {
  return columns.map((col) => `${col}.ilike.${pattern}`).join(",");
}

async function searchTable(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  userId: string,
  workspaceId: string | null,
  entity: GlobalSearchEntity,
  pattern: string,
  perTable: number
): Promise<GlobalSearchResult[]> {
  const orFilter = (cols: string[]) => ilikeOr(cols, pattern);
  const workspaceEntities = new Set([
    "clientes",
    "orcamentos",
    "alvesz_eventos",
  ]);
  if (workspaceEntities.has(entity) && !workspaceId) {
    return [];
  }

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
    case "growth_missions": {
      const { data } = await supabase
        .from("growth_missions")
        .select("id, titulo, mission_date, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "descricao", "mission_key", "status"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          r.titulo,
          (r.mission_date ?? r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "growth_goals": {
      const { data } = await supabase
        .from("growth_goals")
        .select("id, mes_referencia, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["mes_referencia"]))
        .limit(perTable);
      return (data ?? []).map((r) =>
        buildSearchResult(
          entity,
          r.id,
          `Meta ${r.mes_referencia}`,
          (r.updated_at ?? r.created_at).slice(0, 10)
        )
      );
    }
    case "clientes": {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, created_at, updated_at")
        .eq("workspace_id", workspaceId!)
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
        .eq("workspace_id", workspaceId!)
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
        .eq("workspace_id", workspaceId!)
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
    case "health_sessions": {
      const { data } = await supabase
        .from("health_sessions")
        .select("id, titulo, tipo, data, created_at, updated_at")
        .eq("user_id", userId)
        .or(orFilter(["titulo", "tipo", "status", "observacoes"]))
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

async function searchAuraKernel(
  term: string,
  filter: GlobalSearchFilter,
  perTable: number
): Promise<GlobalSearchResult[]> {
  if (filter !== "todos" && filter !== "aura" && filter !== "ia") {
    return [];
  }
  const results: GlobalSearchResult[] = [];
  const q = term.toLowerCase();

  try {
    const { searchMemories } = await import(
      "@/lib/supabase/services/memory-engine.service"
    );
    const { items: mems } = await searchMemories({
      query: term,
      limit: perTable,
    });
    for (const m of mems) {
      results.push(
        buildSearchResult(
          "aura_memories",
          m.id,
          m.title,
          m.createdAt.slice(0, 10)
        )
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchWorldEntities } = await import(
      "@/lib/supabase/services/world-model.service"
    );
    const { items } = await searchWorldEntities({
      query: term,
      limit: perTable,
    });
    for (const e of items) {
      results.push(
        buildSearchResult(
          "aura_entities",
          e.id,
          e.displayName,
          e.createdAt.slice(0, 10)
        )
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchCognitiveArtifacts } = await import(
      "@/lib/supabase/services/cognitive-engine.service"
    );
    const arts = await searchCognitiveArtifacts(term, perTable);
    for (const a of arts) {
      results.push(
        buildSearchResult(
          "aura_insights",
          a.id,
          a.title,
          a.createdAt.slice(0, 10)
        )
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchDiscoveries } = await import(
      "@/lib/supabase/services/discovery-engine.service"
    );
    const discs = await searchDiscoveries(term, perTable);
    for (const d of discs) {
      const row = buildSearchResult(
        "aura_discoveries",
        d.id,
        d.title,
        d.createdAt.slice(0, 10)
      );
      results.push({
        ...row,
        moduleHref: `/dashboard/discovery?id=${d.id}`,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchMemoryAttachments } = await import(
      "@/lib/supabase/services/smart-capture.service"
    );
    const hits = await searchMemoryAttachments(term);
    for (const h of hits.slice(0, perTable)) {
      const row = buildSearchResult(
        "aura_attachments",
        h.attachmentId,
        `${h.fileName} · ${h.matchField}`,
        new Date().toISOString().slice(0, 10)
      );
      results.push({
        ...row,
        moduleHref: h.memoryId
          ? `/dashboard/inbox?id=${h.memoryId}`
          : "/dashboard/attachments",
        title: h.snippet
          ? `${h.fileName}: ${h.snippet.slice(0, 80)}`
          : h.fileName,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchProjectsAndBusiness } = await import(
      "@/lib/supabase/services/projects.service"
    );
    const found = await searchProjectsAndBusiness(term);
    for (const p of found.projects.slice(0, perTable)) {
      results.push({
        ...buildSearchResult(
          "aura_projects",
          p.id,
          p.name,
          p.updatedAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/projects/${p.id}`,
      });
    }
    for (const b of found.businesses.slice(0, perTable)) {
      results.push({
        ...buildSearchResult(
          "aura_businesses",
          b.id,
          b.name,
          b.updatedAt.slice(0, 10)
        ),
        moduleHref: "/dashboard/business",
      });
    }
    for (const d of found.documents.slice(0, perTable)) {
      results.push({
        ...buildSearchResult(
          "aura_attachments",
          d.id,
          d.title,
          d.createdAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/projects/${d.projectId}/documents`,
        typeLabel: "Documento do projeto",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchKnowledge } = await import(
      "@/lib/supabase/services/knowledge-hub.service"
    );
    const found = await searchKnowledge(term, { limit: perTable });
    for (const hit of found.hits) {
      results.push({
        ...buildSearchResult(
          "aura_knowledge",
          hit.document.id,
          hit.document.title,
          hit.document.updatedAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/knowledge/${hit.document.id}`,
        typeLabel: "Knowledge",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchDecisionCards } = await import(
      "@/lib/supabase/services/decision-support.service"
    );
    const found = await searchDecisionCards(term, perTable);
    for (const d of found) {
      results.push({
        ...buildSearchResult(
          "aura_decisions",
          d.id,
          d.title,
          d.updatedAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/decisions/${d.id}`,
        typeLabel: "Decisão",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchScenarioCards } = await import(
      "@/lib/supabase/services/scenario.service"
    );
    const found = await searchScenarioCards(term, perTable);
    for (const s of found) {
      results.push({
        ...buildSearchResult(
          "aura_scenarios",
          s.id,
          s.title,
          s.updatedAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/scenarios/${s.id}`,
        typeLabel: "Cenário",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { searchPriorityItems } = await import(
      "@/lib/supabase/services/prioritization.service"
    );
    const found = await searchPriorityItems(term, perTable);
    for (const p of found) {
      results.push({
        ...buildSearchResult(
          "aura_priorities",
          p.id,
          p.title,
          p.updatedAt.slice(0, 10)
        ),
        moduleHref: `/dashboard/priorities/${p.id}`,
        typeLabel: "Prioridade",
      });
    }
  } catch {
    /* ignore */
  }

  void q;
  return results;
}

export async function runGlobalSearch(
  query: string,
  options: GlobalSearchOptions = {}
): Promise<GlobalSearchResponse> {
  const term = query.trim();
  if (term.length < GLOBAL_SEARCH_MIN_CHARS) {
    return {
      results: [],
      groups: [],
      total: 0,
      hasMore: false,
      error: `Digite pelo menos ${GLOBAL_SEARCH_MIN_CHARS} caracteres.`,
    };
  }

  const ctx = await getDataContext().catch(() => null);
  if (!ctx) {
    return {
      results: [],
      groups: [],
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

  const entities = entitiesForFilter(filter).filter(
    (e) =>
      ![
        "aura_memories",
        "aura_entities",
        "aura_insights",
        "aura_discoveries",
        "aura_attachments",
        "aura_projects",
        "aura_businesses",
        "aura_knowledge",
        "aura_decisions",
        "aura_scenarios",
        "aura_priorities",
      ].includes(e)
  );

  try {
    const workspaceId =
      ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null;

    const batches = await Promise.all(
      entities.map((entity) =>
        searchTable(
          ctx.supabase,
          ctx.userId,
          workspaceId,
          entity,
          pattern,
          perTable
        )
      )
    );

    const kernel = await searchAuraKernel(term, filter, perTable);
    const merged = sortSearchResults([...batches.flat(), ...kernel]);
    const groups = groupSearchResults(merged);
    const { slice, total, hasMore } = paginateSearchResults(merged, page, pageSize);

    return { results: slice, groups, total, hasMore, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na busca global.";
    logSearchFailure(message);
    return {
      results: [],
      groups: [],
      total: 0,
      hasMore: false,
      error: message,
    };
  }
}
