export type GlobalSearchFilter =
  | "todos"
  | "leads"
  | "eventos"
  | "conteudo"
  | "saude"
  | "financeiro"
  | "ia";

export type GlobalSearchModuleKey =
  | "crescimento"
  | "alvesz"
  | "calendario"
  | "saude"
  | "social-media"
  | "financeiro"
  | "aura-central";

export type GlobalSearchEntity =
  | "growth_leads"
  | "growth_missions"
  | "growth_goals"
  | "clientes"
  | "orcamentos"
  | "eventos"
  | "alvesz_eventos"
  | "conteudos"
  | "health_habits"
  | "health_workouts"
  | "health_meals"
  | "health_sessions"
  | "ai_messages"
  | "financial_income"
  | "gastos"
  | "financial_goals";

export type GlobalSearchResult = {
  id: string;
  entity: GlobalSearchEntity;
  typeLabel: string;
  title: string;
  moduleKey: GlobalSearchModuleKey;
  moduleLabel: string;
  moduleHref: string;
  date: string;
  dateIso: string;
};

export type GlobalSearchGroup = {
  moduleKey: GlobalSearchModuleKey;
  moduleLabel: string;
  moduleHref: string;
  results: GlobalSearchResult[];
};

export const GLOBAL_SEARCH_FILTERS: { id: GlobalSearchFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "leads", label: "Crescimento" },
  { id: "eventos", label: "Eventos" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "saude", label: "Saúde" },
  { id: "financeiro", label: "Financeiro" },
  { id: "ia", label: "IA" },
];

export const GLOBAL_SEARCH_DEBOUNCE_MS = 300;
export const GLOBAL_SEARCH_PER_MODULE = 10;
export const GLOBAL_SEARCH_INITIAL_LIMIT = 30;
export const GLOBAL_SEARCH_PAGE_SIZE = 15;
export const GLOBAL_SEARCH_PER_TABLE = 10;
export const GLOBAL_SEARCH_MIN_CHARS = 2;

export const GLOBAL_SEARCH_MODULE_ORDER: GlobalSearchModuleKey[] = [
  "crescimento",
  "alvesz",
  "calendario",
  "saude",
  "social-media",
  "financeiro",
  "aura-central",
];

const ENTITY_META: Record<
  GlobalSearchEntity,
  {
    typeLabel: string;
    moduleKey: GlobalSearchModuleKey;
    moduleLabel: string;
    moduleHref: string;
    filter: GlobalSearchFilter;
  }
> = {
  growth_leads: {
    typeLabel: "Lead",
    moduleKey: "crescimento",
    moduleLabel: "Crescimento",
    moduleHref: "/dashboard/crescimento",
    filter: "leads",
  },
  growth_missions: {
    typeLabel: "Missão",
    moduleKey: "crescimento",
    moduleLabel: "Crescimento",
    moduleHref: "/dashboard/crescimento",
    filter: "leads",
  },
  growth_goals: {
    typeLabel: "Meta",
    moduleKey: "crescimento",
    moduleLabel: "Crescimento",
    moduleHref: "/dashboard/crescimento",
    filter: "leads",
  },
  clientes: {
    typeLabel: "Cliente",
    moduleKey: "alvesz",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "leads",
  },
  orcamentos: {
    typeLabel: "Orçamento",
    moduleKey: "alvesz",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "eventos",
  },
  eventos: {
    typeLabel: "Evento",
    moduleKey: "calendario",
    moduleLabel: "Calendário",
    moduleHref: "/dashboard/calendario",
    filter: "eventos",
  },
  alvesz_eventos: {
    typeLabel: "Evento Alvesz",
    moduleKey: "alvesz",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "eventos",
  },
  conteudos: {
    typeLabel: "Conteúdo",
    moduleKey: "social-media",
    moduleLabel: "Social Media",
    moduleHref: "/dashboard/social-media",
    filter: "conteudo",
  },
  health_habits: {
    typeLabel: "Hábito",
    moduleKey: "saude",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  health_workouts: {
    typeLabel: "Treino",
    moduleKey: "saude",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  health_meals: {
    typeLabel: "Refeição",
    moduleKey: "saude",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  health_sessions: {
    typeLabel: "Sessão",
    moduleKey: "saude",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  ai_messages: {
    typeLabel: "Mensagem IA",
    moduleKey: "aura-central",
    moduleLabel: "Aura Central",
    moduleHref: "/dashboard",
    filter: "ia",
  },
  financial_income: {
    typeLabel: "Receita",
    moduleKey: "financeiro",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
  gastos: {
    typeLabel: "Gasto",
    moduleKey: "financeiro",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
  financial_goals: {
    typeLabel: "Meta financeira",
    moduleKey: "financeiro",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
};

const FILTER_ENTITIES: Record<GlobalSearchFilter, GlobalSearchEntity[] | "all"> = {
  todos: "all",
  leads: ["growth_leads", "growth_missions", "growth_goals", "clientes"],
  eventos: ["eventos", "alvesz_eventos", "orcamentos"],
  conteudo: ["conteudos"],
  saude: ["health_habits", "health_workouts", "health_meals", "health_sessions"],
  financeiro: ["financial_income", "gastos", "financial_goals"],
  ia: ["ai_messages"],
};

const SEARCH_VERB_PREFIX =
  /^\s*(?:buscar|busque|procure|procurar|pesquise|pesquisar)\s+/i;

export function escapeIlikePattern(term: string): string {
  return term.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export function entitiesForFilter(filter: GlobalSearchFilter): GlobalSearchEntity[] {
  const mapped = FILTER_ENTITIES[filter];
  if (mapped === "all") {
    return Object.keys(ENTITY_META) as GlobalSearchEntity[];
  }
  return mapped;
}

export function buildSearchResult(
  entity: GlobalSearchEntity,
  id: string,
  title: string,
  dateIso: string
): GlobalSearchResult {
  const meta = ENTITY_META[entity];
  const safeDate = dateIso?.slice(0, 10) || "1970-01-01";
  return {
    id,
    entity,
    typeLabel: meta.typeLabel,
    title: title.trim() || meta.typeLabel,
    moduleKey: meta.moduleKey,
    moduleLabel: meta.moduleLabel,
    moduleHref: meta.moduleHref,
    date: safeDate,
    dateIso: safeDate,
  };
}

export function sortSearchResults(results: GlobalSearchResult[]): GlobalSearchResult[] {
  return [...results].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

export function groupSearchResults(results: GlobalSearchResult[]): GlobalSearchGroup[] {
  const sorted = sortSearchResults(results);
  const buckets = new Map<GlobalSearchModuleKey, GlobalSearchResult[]>();

  for (const result of sorted) {
    const list = buckets.get(result.moduleKey) ?? [];
    if (list.length < GLOBAL_SEARCH_PER_MODULE) {
      list.push(result);
      buckets.set(result.moduleKey, list);
    }
  }

  return GLOBAL_SEARCH_MODULE_ORDER.filter((key) => buckets.has(key)).map((key) => {
    const sample = buckets.get(key)![0]!;
    return {
      moduleKey: key,
      moduleLabel: sample.moduleLabel,
      moduleHref: sample.moduleHref,
      results: buckets.get(key)!,
    };
  });
}

export function paginateSearchResults(
  results: GlobalSearchResult[],
  page: number,
  pageSize: number
): { slice: GlobalSearchResult[]; total: number; hasMore: boolean } {
  const total = results.length;
  const start = page * pageSize;
  const slice = results.slice(start, start + pageSize);
  return { slice, total, hasMore: start + pageSize < total };
}

export function isAuraGlobalSearchQuery(message: string): boolean {
  return SEARCH_VERB_PREFIX.test(message.trim());
}

export function extractAuraSearchQuery(message: string): string | null {
  const match = message.trim().match(
    /^\s*(?:buscar|busque|procure|procurar|pesquise|pesquisar)\s+(.+)$/i
  );
  if (!match?.[1]) return null;
  const q = match[1].trim();
  return q.length >= GLOBAL_SEARCH_MIN_CHARS ? q : null;
}

export function formatGlobalSearchReply(
  results: GlobalSearchResult[],
  query: string,
  total: number
): string {
  if (total === 0) {
    return `Nenhum resultado encontrado para "${query}".`;
  }

  const groups = groupSearchResults(results);
  const lines = groups.flatMap((group) => [
    `${group.moduleLabel}:`,
    ...group.results.map(
      (r) => `· [${r.typeLabel}] ${r.title} · ${formatSearchDate(r.dateIso)}`
    ),
  ]);

  const more =
    total > results.length
      ? `\n\n+${total - results.length} resultado(s) — use a busca no topo para ver todos.`
      : "";

  return `Resultados para "${query}" (${total}):\n\n${lines.join("\n")}${more}`;
}

function formatSearchDate(iso: string): string {
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—";
  const [y, m, day] = d.split("-");
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const mi = Number(m) - 1;
  return `${day} ${months[mi] ?? m} ${y}`;
}

export function formatResultDateLabel(iso: string): string {
  return formatSearchDate(iso);
}
