import type { AiMemoryCategoria, AiModule } from "@/types/database";
import { truncatePreview } from "@/utils/memory";

export const AI_MEMORY_CATEGORIAS: {
  id: AiMemoryCategoria;
  label: string;
}[] = [
  { id: "coach", label: "Aura Coach" },
  { id: "mentor", label: "Aura Mentor" },
  { id: "calendario", label: "Calendário" },
  { id: "financeiro", label: "Financeiro" },
  { id: "saude", label: "Saúde" },
  { id: "alvesz", label: "Alvesz" },
  { id: "crescimento", label: "Crescimento" },
  { id: "social_media", label: "Social Media" },
  { id: "legado", label: "Legado & Hall da Fama" },
];

export const AI_MEMORY_CATEGORY_LABELS: Record<AiMemoryCategoria, string> =
  Object.fromEntries(
    AI_MEMORY_CATEGORIAS.map((c) => [c.id, c.label])
  ) as Record<AiMemoryCategoria, string>;

const PERSIST_KINDS = new Set([
  "treino",
  "habitos",
  "dieta",
  "roteiro",
  "ideias",
  "report",
  "coach",
  "command",
  "calendario",
  "estrategia",
  "prioridade",
  "vendas",
  "conteudo",
  "comms",
  "legado",
  "creator",
  "research",
  "copylab",
  "launch",
  "money",
  "ceo",
  "execution",
]);

const KIND_TITLES: Record<string, string> = {
  treino: "Treino sugerido",
  habitos: "Hábitos recomendados",
  dieta: "Plano alimentar sugerido",
  roteiro: "Roteiro de conteúdo",
  ideias: "Ideias de conteúdo",
  report: "Relatório executivo",
  coach: "Recomendação da Aura Coach",
  command: "Ação executada na Aura",
  calendario: "Sugestão de agenda",
  estrategia: "Estratégia de crescimento",
  prioridade: "Prioridade recomendada",
  vendas: "Plano de vendas",
  conteudo: "Conteúdo gerado",
  legado: "História e legado",
  creator: "Produto digital",
  research: "Pesquisa de mercado",
  copylab: "Copy de produto",
  launch: "Plano de lançamento",
  money: "Plano financeiro",
  ceo: "Estratégia CEO",
  execution: "Execução diária",
};

const COACH_MODE_TITLES: Record<string, string> = {
  today: "Prioridades de hoje",
  "executive-week": "Panorama da semana",
  performance: "Análise de performance",
  alerts: "Alertas executivos",
  opportunity: "Oportunidade recomendada",
  intro: "Apresentação da Aura Coach",
  "creator-product": "Criar produto digital",
  "creator-launch": "Produto para lançar",
  "creator-best-seller": "Maior chance de venda",
  "creator-plan": "Plano de 30 dias",
  "creator-niche": "Nicho mais forte",
  "research-analyze": "Análise de ideia",
  "research-niche": "Nicho vale a pena?",
  "research-products": "Produtos no mercado",
  "copylab-create": "Criar copy",
  "copylab-improve": "Melhorar oferta",
  "copylab-vsl": "Criar VSL",
  "launch-next": "Próximo passo",
  "launch-missing": "O que falta para lançar",
  "launch-monetize": "Quanto falta para monetizar",
  "money-earn": "Como ganhar dinheiro",
  "money-today": "O que fazer hoje",
  "money-opportunity": "Melhor oportunidade",
  "money-late": "Missão atrasada",
  "ceo-focus": "Foco de hoje",
  "ceo-delay": "O que está atrasando",
  "ceo-opportunity": "Oportunidade a aproveitar",
  "ceo-plan-30": "Plano 30 dias",
};

export function shouldPersistAuraMemory(
  assistantContent: string,
  metadata: Record<string, unknown> = {}
): boolean {
  const kind = typeof metadata.kind === "string" ? metadata.kind : undefined;
  if (kind && PERSIST_KINDS.has(kind)) return true;
  if (kind === "chat" && assistantContent.length >= 480) return true;
  if (!kind && assistantContent.length >= 600) return true;
  return false;
}

export function resolveAuraMemoryCategoria(
  module: AiModule,
  metadata: Record<string, unknown> = {}
): AiMemoryCategoria {
  const kind = typeof metadata.kind === "string" ? metadata.kind : undefined;
  const auraModule =
    typeof metadata.module === "string" ? metadata.module : undefined;

  if (kind === "treino" || kind === "habitos" || kind === "dieta" || module === "saude") {
    return "saude";
  }
  if (module === "agenda" || kind === "calendario") return "calendario";
  if (module === "social" || kind === "roteiro" || kind === "ideias" || kind === "conteudo") {
    return "social_media";
  }
  if (auraModule === "alvesz" || kind === "alvesz") return "alvesz";
  if (auraModule === "financeiro" || kind === "financeiro" || kind === "money") return "financeiro";
  if (kind === "ceo") return "coach";
  if (auraModule === "crescimento" || kind === "vendas" || kind === "estrategia" || kind === "command") {
    return "crescimento";
  }
  if (module === "mentor" || kind === "report") return "mentor";
  if (kind === "coach") return "coach";
  if (module === "aura_central") return "coach";
  if (module === "legado" || kind === "legado") return "legado";
  if (module === "execution" || kind === "execution") return "coach";
  if (module === "creator" || kind === "creator" || kind === "copylab" || kind === "launch" || kind === "money" || kind === "ceo")
    return "mentor";
  return "mentor";
}

export function resolveAuraMemoryOrigem(
  module: AiModule,
  metadata: Record<string, unknown> = {}
): string {
  const kind = typeof metadata.kind === "string" ? metadata.kind : undefined;
  if (kind) return `${module}:${kind}`;
  return module;
}

export function buildAuraMemoryTitle(
  module: AiModule,
  userMessage: string,
  metadata: Record<string, unknown> = {}
): string {
  const kind = typeof metadata.kind === "string" ? metadata.kind : undefined;
  const coachMode =
    typeof metadata.coachMode === "string" ? metadata.coachMode : undefined;

  if (kind === "coach" && coachMode && COACH_MODE_TITLES[coachMode]) {
    return COACH_MODE_TITLES[coachMode];
  }
  if (kind && KIND_TITLES[kind]) return KIND_TITLES[kind];
  const fromUser = truncatePreview(userMessage, 80);
  if (fromUser) return fromUser;
  return "Registro da Aura";
}

export function formatAuraMemoryDate(iso: string): string {
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—";
  const [y, m, day] = d.split("-");
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${day} ${months[Number(m) - 1] ?? m} ${y}`;
}
