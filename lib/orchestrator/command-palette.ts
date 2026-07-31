/**
 * Command Palette V2 — natural command understanding for Ctrl+K.
 */

import type { CommandIntent, CommandIntentKind } from "@/lib/orchestrator/types";

type Rule = {
  kind: CommandIntentKind;
  patterns: RegExp[];
  href: string;
  label: string;
  filterHint?: string | null;
};

const RULES: Rule[] = [
  {
    kind: "open_project",
    patterns: [
      /\babrir\s+projeto/i,
      /\bopen\s+project/i,
      /\bprojetos?\s+ativos?/i,
      /\bver\s+projetos?/i,
    ],
    href: "/dashboard/projects",
    label: "Abrir projetos",
  },
  {
    kind: "show_risks",
    patterns: [
      /\bmostrar\s+riscos?/i,
      /\briscos?/i,
      /\bshow\s+risks?/i,
      /\balertas?\s+de\s+risco/i,
    ],
    href: "/dashboard/priorities",
    label: "Mostrar riscos / prioridades",
    filterHint: "aura",
  },
  {
    kind: "open_discovery",
    patterns: [
      /\babrir\s+discovery/i,
      /\babrir\s+descobertas?/i,
      /\bdescobertas?/i,
      /\bopen\s+discovery/i,
    ],
    href: "/dashboard/discovery",
    label: "Abrir Discovery",
  },
  {
    kind: "create_memory",
    patterns: [
      /\bcriar\s+mem[oó]ria/i,
      /\bregistrar\s+mem[oó]ria/i,
      /\bnova\s+mem[oó]ria/i,
      /\bcreate\s+memory/i,
    ],
    href: "/dashboard/settings/memory",
    label: "Criar memória",
  },
  {
    kind: "execute_plan",
    patterns: [
      /\bexecutar\s+plano/i,
      /\babrir\s+plano/i,
      /\brun\s+plan/i,
      /\bexecute\s+plan/i,
      /\bplanos?\s+ativos?/i,
    ],
    href: "/dashboard/plans",
    label: "Executar / abrir plano",
  },
  {
    kind: "open_agent",
    patterns: [
      /\babrir\s+agente/i,
      /\bagentes?\s+ativos?/i,
      /\bopen\s+agent/i,
      /\bagent\s+center/i,
    ],
    href: "/dashboard/agents",
    label: "Abrir Agent Center",
  },
  {
    kind: "search_document",
    patterns: [
      /\bprocurar\s+documento/i,
      /\bbuscar\s+documento/i,
      /\bdocumentos?\s+sobre\b/i,
      /\bsearch\s+document/i,
      /\bknowledge\b/i,
    ],
    href: "/dashboard/knowledge",
    label: "Procurar documento",
    filterHint: "aura",
  },
  {
    kind: "open_plans",
    patterns: [/\babrir\s+planos?/i, /\bplan\s+center/i],
    href: "/dashboard/plans",
    label: "Abrir Plan Center",
  },
  {
    kind: "open_automations",
    patterns: [/\babrir\s+automa/i, /\bautomation\s+center/i],
    href: "/dashboard/automations",
    label: "Abrir Automation Center",
  },
  {
    kind: "open_recommendations",
    patterns: [/\brecomenda/i, /\brecommendation\s+center/i],
    href: "/dashboard/recommendations",
    label: "Abrir recomendações",
  },
  {
    kind: "open_priorities",
    patterns: [/\bprioridades?/i, /\bpriority\s+center/i],
    href: "/dashboard/priorities",
    label: "Abrir prioridades",
  },
  {
    kind: "open_missions",
    patterns: [/\babrir\s+miss/i, /\bmiss[oõ]es?\b/i],
    href: "/dashboard/missions",
    label: "Abrir missões",
  },
  {
    kind: "open_home",
    patterns: [/\baura\s+home/i, /\bmeu\s+dia/i, /\bin[ií]cio\b/i, /\bhome\b/i],
    href: "/dashboard",
    label: "Abrir Aura Home",
  },
];

export function parseCommandIntent(query: string): CommandIntent {
  const q = query.trim();
  if (!q) {
    return {
      kind: "unknown",
      confidence: 0,
      href: "/dashboard",
      label: "Aura Home",
      searchQuery: null,
      filterHint: null,
    };
  }

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(q)) {
        const searchQuery =
          rule.kind === "search_document"
            ? q
                .replace(
                  /^(?:procurar|buscar|search)\s+documento(?:s)?\s*(?:sobre)?\s*/i,
                  ""
                )
                .trim() || null
            : null;
        return {
          kind: rule.kind,
          confidence: 0.9,
          href: rule.href,
          label: rule.label,
          searchQuery,
          filterHint: rule.filterHint ?? null,
        };
      }
    }
  }

  return {
    kind: "search_nl",
    confidence: 0.5,
    href: "/dashboard",
    label: `Buscar: ${q}`,
    searchQuery: q,
    filterHint: "todos",
  };
}

export function listCommandSuggestions(query: string, limit = 8): CommandIntent[] {
  const q = query.trim().toLowerCase();
  const matched = RULES.map((rule) => {
    const hit = !q || rule.patterns.some((p) => p.test(q)) || rule.label.toLowerCase().includes(q);
    return hit
      ? ({
          kind: rule.kind,
          confidence: q ? 0.85 : 0.6,
          href: rule.href,
          label: rule.label,
          searchQuery: null,
          filterHint: rule.filterHint ?? null,
        } satisfies CommandIntent)
      : null;
  }).filter(Boolean) as CommandIntent[];

  if (!matched.length && q) {
    return [parseCommandIntent(query)].slice(0, limit);
  }
  return matched.slice(0, limit);
}

export function isCommandLikeQuery(query: string): boolean {
  const intent = parseCommandIntent(query);
  return intent.kind !== "unknown" && intent.kind !== "search_nl";
}
