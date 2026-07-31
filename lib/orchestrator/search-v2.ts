/**
 * Global Search V2 — natural language intent over existing search.
 * Does not replace runGlobalSearch; enriches query + filter hints.
 */

import type { NaturalSearchIntent } from "@/lib/orchestrator/types";

const VERB_PREFIX =
  /^\s*(?:buscar|busque|procure|procurar|pesquise|pesquisar|mostrar|mostre|listar|liste|abrir|abre|find|show|list|open)\s+/i;

const ENTITY_PATTERNS: Array<{ hint: string; re: RegExp; filter?: NaturalSearchIntent["filter"]; href?: string }> = [
  { hint: "document", re: /\bdocumentos?\b|\bknowledge\b|\barquivos?\b/i, filter: "aura", href: "/dashboard/knowledge" },
  { hint: "project", re: /\bprojetos?\b/i, filter: "aura", href: "/dashboard/projects" },
  { hint: "idea", re: /\bideias?\b|\bneg[oó]cio/i, filter: "aura", href: "/dashboard/discovery" },
  { hint: "memory", re: /\bmem[oó]rias?\b/i, filter: "aura", href: "/dashboard/settings/memory" },
  { hint: "plan", re: /\bplanos?\b/i, filter: "aura", href: "/dashboard/plans" },
  { hint: "agent", re: /\bagentes?\b/i, filter: "aura", href: "/dashboard/agents" },
  { hint: "automation", re: /\bautoma/i, filter: "aura", href: "/dashboard/automations" },
  { hint: "recommendation", re: /\brecomenda/i, filter: "aura", href: "/dashboard/recommendations" },
  { hint: "decision", re: /\bdecis/i, filter: "aura", href: "/dashboard/decisions" },
  { hint: "mission", re: /\bmiss[oõ]es?\b/i, filter: "leads", href: "/dashboard/missions" },
  { hint: "lead", re: /\bleads?\b/i, filter: "leads", href: "/dashboard/crescimento" },
  { hint: "finance", re: /\bfinanceiro\b|\bgastos?\b|\breceitas?\b/i, filter: "financeiro", href: "/dashboard/financeiro" },
  { hint: "health", re: /\bsa[uú]de\b|\btreino\b/i, filter: "saude", href: "/dashboard/saude" },
  { hint: "content", re: /\bconte[uú]do\b|\binstagram\b/i, filter: "conteudo", href: "/dashboard/social-media" },
];

const STATUS_PATTERNS: Array<{ hint: string; re: RegExp }> = [
  { hint: "active", re: /\bativos?\b|\bactive\b|\bem\s+andamento\b/i },
  { hint: "pending", re: /\bpendentes?\b|\baguardando\b/i },
  { hint: "blocked", re: /\bbloqueados?\b|\bblocked\b/i },
  { hint: "risk", re: /\briscos?\b|\balertas?\b/i },
];

const TOPIC_STRIP =
  /\b(?:documentos?|projetos?|ideias?|mem[oó]rias?|planos?|agentes?|automa(?:ção|ções)|recomenda(?:ção|ções)|decis(?:ão|ões)|miss[oõ]es?|leads?|sobre|de|da|do|dos|das|ativos?|pendentes?)\b/gi;

export function parseNaturalSearchQuery(raw: string): NaturalSearchIntent {
  const trimmed = raw.trim();
  const withoutVerb = trimmed.replace(VERB_PREFIX, "").trim() || trimmed;

  const entityHints: string[] = [];
  let filter: NaturalSearchIntent["filter"] = "todos";
  let hrefFallback: string | null = null;

  for (const e of ENTITY_PATTERNS) {
    if (e.re.test(withoutVerb)) {
      entityHints.push(e.hint);
      if (filter === "todos" && e.filter) filter = e.filter;
      if (!hrefFallback && e.href) hrefFallback = e.href;
    }
  }

  const statusHints = STATUS_PATTERNS.filter((s) => s.re.test(withoutVerb)).map(
    (s) => s.hint
  );

  const cleanedQuery = withoutVerb
    .replace(TOPIC_STRIP, " ")
    .replace(/\s+/g, " ")
    .trim();

  const topicHints = cleanedQuery
    ? cleanedQuery.split(/\s+/).filter((t) => t.length > 1).slice(0, 6)
    : [];

  // "documentos sobre Disney" → cleaned "Disney"
  // "projetos ativos" → cleaned "" but entity+status hints remain
  return {
    raw: trimmed,
    cleanedQuery: cleanedQuery || withoutVerb,
    entityHints,
    statusHints,
    topicHints,
    filter,
    hrefFallback,
  };
}

export function resolveSearchQueryForIndex(raw: string): {
  query: string;
  filter: NaturalSearchIntent["filter"];
  intent: NaturalSearchIntent;
} {
  const intent = parseNaturalSearchQuery(raw);
  // Prefer topic terms for ILIKE; fall back to cleaned / raw
  const query =
    intent.topicHints.join(" ").trim() ||
    intent.cleanedQuery ||
    intent.raw;
  return { query, filter: intent.filter, intent };
}

export function describeNaturalSearch(intent: NaturalSearchIntent): string {
  const parts: string[] = [];
  if (intent.entityHints.length) parts.push(intent.entityHints.join(", "));
  if (intent.statusHints.length) parts.push(intent.statusHints.join(", "));
  if (intent.topicHints.length) parts.push(`tema: ${intent.topicHints.join(" ")}`);
  return parts.join(" · ") || intent.raw;
}
