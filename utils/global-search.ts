export type GlobalSearchFilter =
  | "todos"
  | "leads"
  | "eventos"
  | "conteudo"
  | "saude"
  | "financeiro"
  | "ia";

export type GlobalSearchEntity =
  | "growth_leads"
  | "clientes"
  | "orcamentos"
  | "eventos"
  | "alvesz_eventos"
  | "conteudos"
  | "health_habits"
  | "health_workouts"
  | "health_meals"
  | "ai_messages"
  | "financial_income"
  | "gastos"
  | "financial_goals";

export type GlobalSearchResult = {
  id: string;
  entity: GlobalSearchEntity;
  typeLabel: string;
  title: string;
  moduleLabel: string;
  moduleHref: string;
  date: string;
  dateIso: string;
};

export const GLOBAL_SEARCH_FILTERS: { id: GlobalSearchFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "leads", label: "Leads" },
  { id: "eventos", label: "Eventos" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "saude", label: "Saúde" },
  { id: "financeiro", label: "Financeiro" },
  { id: "ia", label: "IA" },
];

export const GLOBAL_SEARCH_INITIAL_LIMIT = 15;
export const GLOBAL_SEARCH_PAGE_SIZE = 15;
export const GLOBAL_SEARCH_PER_TABLE = 6;
export const GLOBAL_SEARCH_MIN_CHARS = 2;

const ENTITY_META: Record<
  GlobalSearchEntity,
  { typeLabel: string; moduleLabel: string; moduleHref: string; filter: GlobalSearchFilter }
> = {
  growth_leads: {
    typeLabel: "Lead",
    moduleLabel: "Crescimento",
    moduleHref: "/dashboard/crescimento",
    filter: "leads",
  },
  clientes: {
    typeLabel: "Cliente",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "leads",
  },
  orcamentos: {
    typeLabel: "Orçamento",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "eventos",
  },
  eventos: {
    typeLabel: "Evento",
    moduleLabel: "Calendário",
    moduleHref: "/dashboard/calendario",
    filter: "eventos",
  },
  alvesz_eventos: {
    typeLabel: "Evento Alvesz",
    moduleLabel: "Alvesz",
    moduleHref: "/dashboard/alvesz",
    filter: "eventos",
  },
  conteudos: {
    typeLabel: "Conteúdo",
    moduleLabel: "Social Media",
    moduleHref: "/dashboard/social-media",
    filter: "conteudo",
  },
  health_habits: {
    typeLabel: "Hábito",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  health_workouts: {
    typeLabel: "Treino",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  health_meals: {
    typeLabel: "Refeição",
    moduleLabel: "Saúde",
    moduleHref: "/dashboard/saude",
    filter: "saude",
  },
  ai_messages: {
    typeLabel: "Mensagem IA",
    moduleLabel: "Aura Central",
    moduleHref: "/dashboard",
    filter: "ia",
  },
  financial_income: {
    typeLabel: "Receita",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
  gastos: {
    typeLabel: "Gasto",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
  financial_goals: {
    typeLabel: "Meta financeira",
    moduleLabel: "Financeiro",
    moduleHref: "/dashboard/financeiro",
    filter: "financeiro",
  },
};

const FILTER_ENTITIES: Record<GlobalSearchFilter, GlobalSearchEntity[] | "all"> = {
  todos: "all",
  leads: ["growth_leads", "clientes"],
  eventos: ["eventos", "alvesz_eventos", "orcamentos"],
  conteudo: ["conteudos"],
  saude: ["health_habits", "health_workouts", "health_meals"],
  financeiro: ["financial_income", "gastos", "financial_goals"],
  ia: ["ai_messages"],
};

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
  return {
    id,
    entity,
    typeLabel: meta.typeLabel,
    title: title.trim() || meta.typeLabel,
    moduleLabel: meta.moduleLabel,
    moduleHref: meta.moduleHref,
    date: dateIso,
    dateIso,
  };
}

export function sortSearchResults(results: GlobalSearchResult[]): GlobalSearchResult[] {
  return [...results].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
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
  return /^\s*buscar\s+\S+/i.test(message.trim());
}

export function extractAuraSearchQuery(message: string): string | null {
  const match = message.trim().match(/^\s*buscar\s+(.+)$/i);
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

  const lines = results.map(
    (r) => `[${r.typeLabel}]\n${r.title}\n${r.moduleLabel} · ${formatSearchDate(r.dateIso)}`
  );

  const more = total > results.length ? `\n\n+${total - results.length} resultado(s) — use a busca no topo para ver todos.` : "";

  return `Resultados para "${query}" (${total}):\n\n${lines.join("\n\n")}${more}`;
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
