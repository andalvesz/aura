export type AuraAgentId =
  | "ceo"
  | "money"
  | "creator"
  | "marketing"
  | "performance"
  | "global"
  | "knowledge"
  | "execution";

export type AuraBrainSectionKey =
  | "legado"
  | "negocios"
  | "financeiro"
  | "global"
  | "execucao"
  | "memoria";

export type AuraAgentDefinition = {
  id: AuraAgentId;
  name: string;
  label: string;
  responsibilities: string[];
  keywords: readonly string[];
  brainSections: readonly AuraBrainSectionKey[];
};

export const AURA_AGENT_REGISTRY: readonly AuraAgentDefinition[] = [
  {
    id: "ceo",
    name: "Aura CEO Agent",
    label: "CEO",
    responsibilities: ["estratégia", "prioridades", "oportunidades"],
    keywords: [
      "estrategia",
      "estratégia",
      "prioridade",
      "oportunidade",
      "foco",
      "priorizar",
      "ceo",
      "visao",
      "visão",
      "planejamento",
      "decisao",
      "decisão",
    ],
    brainSections: ["legado", "execucao"],
  },
  {
    id: "money",
    name: "Money Agent",
    label: "Money",
    responsibilities: ["metas financeiras", "ROI", "orçamento", "faturamento"],
    keywords: [
      "dinheiro",
      "financeiro",
      "orcamento",
      "orçamento",
      "roi",
      "faturamento",
      "receita",
      "lucro",
      "ganhar",
      "ganho",
      "faturar",
      "investimento",
      "meta financeira",
      "r$",
      "us$",
      "dolar",
      "dólar",
      "dollar",
    ],
    brainSections: ["financeiro"],
  },
  {
    id: "creator",
    name: "Creator Agent",
    label: "Creator",
    responsibilities: ["novos produtos", "validação", "expansão"],
    keywords: [
      "produto",
      "creator",
      "validar",
      "validacao",
      "validação",
      "expansao",
      "expansão",
      "lancar",
      "lançar",
      "lancamento",
      "lançamento",
      "criar produto",
      "nicho",
      "oferta",
    ],
    brainSections: ["negocios"],
  },
  {
    id: "marketing",
    name: "Marketing Agent",
    label: "Marketing",
    responsibilities: ["CopyLab", "Creative Studio", "Landing", "Ads"],
    keywords: [
      "copy",
      "copylab",
      "criativo",
      "criativos",
      "landing",
      "ads",
      "anuncio",
      "anúncio",
      "campanha",
      "marketing",
      "creative studio",
      "studio",
      "headline",
      "publicidade",
    ],
    brainSections: ["negocios"],
  },
  {
    id: "performance",
    name: "Performance Agent",
    label: "Performance",
    responsibilities: ["CTR", "CPA", "ROAS", "otimizações"],
    keywords: [
      "ctr",
      "cpa",
      "roas",
      "otimizacao",
      "otimização",
      "otimizar",
      "performance",
      "metricas",
      "métricas",
      "conversao",
      "conversão",
      "autopilot",
    ],
    brainSections: ["memoria", "negocios"],
  },
  {
    id: "global",
    name: "Global Agent",
    label: "Global",
    responsibilities: ["países", "idiomas", "moedas", "mercados"],
    keywords: [
      "pais",
      "país",
      "paises",
      "países",
      "idioma",
      "moeda",
      "mercado",
      "internacional",
      "global",
      "eua",
      "usa",
      "brasil",
      "europa",
      "dolar",
      "dólar",
      "usd",
      "us$",
    ],
    brainSections: ["global"],
  },
  {
    id: "knowledge",
    name: "Knowledge Agent",
    label: "Knowledge",
    responsibilities: ["memória empresarial", "padrões", "aprendizados"],
    keywords: [
      "memoria",
      "memória",
      "aprendizado",
      "padrao",
      "padrão",
      "padroes",
      "padrões",
      "historico",
      "histórico",
      "conhecimento",
      "erros",
      "aprendemos",
      "vencedor",
      "vencedores",
    ],
    brainSections: ["memoria"],
  },
  {
    id: "execution",
    name: "Execution Agent",
    label: "Execution",
    responsibilities: ["tarefas", "Daily Briefing", "acompanhamento"],
    keywords: [
      "tarefa",
      "tarefas",
      "briefing",
      "execucao",
      "execução",
      "executar",
      "plano do dia",
      "daily",
      "acompanhamento",
      "pendente",
      "pendentes",
      "hoje devo",
      "fazer hoje",
    ],
    brainSections: ["execucao"],
  },
] as const;

const REVENUE_BUNDLE: readonly AuraAgentId[] = [
  "ceo",
  "money",
  "creator",
  "marketing",
  "global",
];

const INTERNATIONAL_CURRENCY_MARKERS = [
  "us$",
  "usd",
  "dolar",
  "dólar",
  "dollar",
  "euro",
  "eur",
  "internacional",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isRevenueQuery(normalized: string): boolean {
  return (
    normalized.includes("ganhar") ||
    normalized.includes("ganho") ||
    normalized.includes("faturar") ||
    normalized.includes("faturamento") ||
    normalized.includes("receita") ||
    normalized.includes("lucro") ||
    /\b\d+[\.,]?\d*\s*(mil|k|000)\b/.test(normalized) ||
    normalized.includes("r$") ||
    normalized.includes("us$")
  );
}

function hasInternationalCurrency(normalized: string): boolean {
  return INTERNATIONAL_CURRENCY_MARKERS.some((marker) =>
    normalized.includes(normalize(marker))
  );
}

export function getAgentDefinition(agentId: AuraAgentId): AuraAgentDefinition {
  const agent = AURA_AGENT_REGISTRY.find((entry) => entry.id === agentId);
  if (!agent) {
    throw new Error(`Agente desconhecido: ${agentId}`);
  }
  return agent;
}

export function selectAgentsForQuery(message: string): AuraAgentId[] {
  const normalized = normalize(message);
  if (!normalized) return [];

  const scores = new Map<AuraAgentId, number>();

  for (const agent of AURA_AGENT_REGISTRY) {
    let score = 0;
    for (const keyword of agent.keywords) {
      if (normalized.includes(normalize(keyword))) score += 1;
    }
    if (score > 0) scores.set(agent.id, score);
  }

  if (isRevenueQuery(normalized)) {
    for (const agentId of REVENUE_BUNDLE) {
      scores.set(agentId, (scores.get(agentId) ?? 0) + 2);
    }
  }

  if (hasInternationalCurrency(normalized)) {
    scores.set("global", (scores.get("global") ?? 0) + 2);
    scores.set("money", (scores.get("money") ?? 0) + 1);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([agentId]) => agentId);

  if (ranked.length === 0) return ["ceo"];

  return ranked;
}

export function isAuraBrainAgentRoutingQuery(message: string): boolean {
  const normalized = normalize(message);
  if (!normalized) return false;

  if (
    normalized.includes("multi agent") ||
    normalized.includes("multiagente") ||
    normalized.includes("consultar agentes") ||
    normalized.includes("sistema de agentes")
  ) {
    return true;
  }

  const agents = selectAgentsForQuery(message);
  return agents.length >= 2 || isRevenueQuery(normalized);
}

export function buildAgentOwnerReply(message: string): string {
  const agents = selectAgentsForQuery(message);
  const trimmed = message.trim();
  const topic =
    trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed || "este tema";

  if (agents.length === 0) {
    return "Nenhum agente específico identificado. O Aura Brain pode coordenar a resposta.";
  }

  const lines = agents.map((agentId, index) => {
    const agent = getAgentDefinition(agentId);
    const lead = index === 0 ? "Responsável principal" : "Consultado";
    return `• **${lead}: ${agent.name}** — ${agent.responsibilities.join(", ")}`;
  });

  const header = `Para **${topic}**, o Aura Brain consultaria:`;
  return [
    header,
    "",
    lines.join("\n"),
    "",
    "O Brain unifica as perspectivas dos agentes em uma resposta estratégica.",
  ].join("\n");
}
