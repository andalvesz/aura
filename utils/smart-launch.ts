import type { AuraSmartLaunchSession } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { formatBRL } from "@/utils/creator";
import {
  DEFAULT_CREATOR_LOCALE,
  formatCreatorMoney,
  type CreatorLocale,
} from "@/utils/creator-locale";
import { GLOBAL_OBJECTIVES } from "@/utils/global";
import { META_READ_ONLY_MODE } from "@/utils/meta-intelligence";
import { parseOrchestratorLaunchPlan } from "@/utils/campaign-orchestrator";

export const SMART_LAUNCH_SAFE_MODE = true;

export type SmartLaunchProductType = "proprio" | "afiliado";
export type SmartLaunchStatus = "draft" | "preparing" | "prepared" | "failed";
export type SmartLaunchWizardStep = 1 | 2 | 3 | 4;

export const SMART_LAUNCH_WIZARD_STEPS: { step: SmartLaunchWizardStep; label: string }[] = [
  { step: 1, label: "Tipo de produto" },
  { step: 2, label: "Mercado" },
  { step: 3, label: "Metas financeiras" },
  { step: 4, label: "Gerar lançamento" },
];

export const SMART_LAUNCH_MODULES = [
  { id: "aura-brain", label: "Aura Brain" },
  { id: "creator", label: "Creator" },
  { id: "research", label: "Market Research" },
  { id: "copylab", label: "CopyLab" },
  { id: "factory", label: "Product Factory" },
  { id: "landing", label: "Landing Builder" },
  { id: "kiwify", label: "Kiwify" },
  { id: "meta", label: "Meta Intelligence" },
  { id: "revenue", label: "Revenue Center" },
  { id: "performance", label: "Performance AI" },
] as const;

export type SmartLaunchIntake = {
  session_id?: string | null;
  product_type: SmartLaunchProductType;
  product_id?: string | null;
  ideia?: string;
  nicho?: string;
  publico?: string;
  target_country: CreatorLocale["target_country"];
  target_language: CreatorLocale["target_language"];
  currency: CreatorLocale["currency"];
  meta_financeira: number;
  orcamento_disponivel: number;
};

export type SmartLaunchScore = {
  probabilidade_sucesso: number;
  risco: "baixo" | "medio" | "alto";
  roi_estimado: number;
  tempo_estimado_dias: number;
  score_geral: number;
};

export type SmartLaunchGeneratedOutputs = {
  produto: string;
  oferta: string;
  pdf: string;
  landing: string;
  estrategia: string;
  campanha_meta: string;
  publico: string;
  cronograma: { dia: number; foco: string; tarefas: string[] }[];
};

export type GeneratedSmartLaunchPlan = {
  smart_score: SmartLaunchScore;
  generated_outputs: SmartLaunchGeneratedOutputs;
  estrategia: string;
  resumo: string;
};

export type SmartLaunchDashboardMetrics = {
  sessoesTotal: number;
  melhorScore: number;
  investimentoMedio: number;
  ultimoProduto: string;
  modoSeguro: boolean;
};

export type SmartLaunchCenterData = {
  session: AuraSmartLaunchSession | null;
  bundle: CreatorProductBundle | null;
};

export const SMART_LAUNCH_AI_CONTEXT = `Você é a Aura Smart Launch — orquestra todos os módulos da Aura em um fluxo único de lançamento.
Utilize Aura Brain, Creator, Market Research, CopyLab, Product Factory, Landing Builder, Kiwify, Meta Intelligence, Revenue Center e Performance AI.
Gere produto, oferta, PDF, landing, estratégia, campanha Meta (rascunho), público e cronograma.
MODO SEGURO ATIVO: NUNCA publique campanhas — apenas prepare estruturas em rascunho.`;

export const SMART_LAUNCH_IA_ACTIONS = [
  {
    id: "preparar",
    label: "Preparar lançamento",
    prompt: "Prepare um lançamento completo com todos os módulos.",
  },
  {
    id: "melhor",
    label: "Melhor lançamento",
    prompt: "Qual meu melhor lançamento?",
  },
  {
    id: "investir",
    label: "Quanto investir",
    prompt: "Quanto preciso investir?",
  },
] as const;

const CEO_SMART_LAUNCH_PREPARE_PHRASES = [
  "prepare um lancamento",
  "preparar um lancamento",
  "prepare o lancamento",
  "preparar lancamento",
] as const;

const CEO_SMART_LAUNCH_BEST_PHRASES = [
  "qual meu melhor lancamento",
  "melhor lancamento",
  "meu melhor lancamento",
] as const;

const CEO_SMART_LAUNCH_INVEST_PHRASES = [
  "quanto preciso investir",
  "quanto devo investir",
  "quanto investir no lancamento",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type SmartLaunchCoachMode =
  | "smart-launch-prepare"
  | "smart-launch-best"
  | "smart-launch-invest";

export function detectSmartLaunchCoachMode(message: string): SmartLaunchCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, CEO_SMART_LAUNCH_PREPARE_PHRASES)) return "smart-launch-prepare";
  if (matchesAny(normalized, CEO_SMART_LAUNCH_BEST_PHRASES)) return "smart-launch-best";
  if (matchesAny(normalized, CEO_SMART_LAUNCH_INVEST_PHRASES)) return "smart-launch-invest";
  return null;
}

export function parseSmartLaunchScore(value: unknown): SmartLaunchScore | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.probabilidade_sucesso !== "number") return null;
  return {
    probabilidade_sucesso: Math.round(raw.probabilidade_sucesso),
    risco:
      raw.risco === "baixo" || raw.risco === "medio" || raw.risco === "alto"
        ? raw.risco
        : "medio",
    roi_estimado: typeof raw.roi_estimado === "number" ? Math.round(raw.roi_estimado) : 0,
    tempo_estimado_dias:
      typeof raw.tempo_estimado_dias === "number" ? Math.round(raw.tempo_estimado_dias) : 14,
    score_geral: typeof raw.score_geral === "number" ? Math.round(raw.score_geral) : 0,
  };
}

export function parseSmartLaunchOutputs(value: unknown): SmartLaunchGeneratedOutputs | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const cronograma = Array.isArray(raw.cronograma)
    ? raw.cronograma.filter(
        (item): item is SmartLaunchGeneratedOutputs["cronograma"][number] =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { dia?: unknown }).dia === "number" &&
          typeof (item as { foco?: unknown }).foco === "string" &&
          Array.isArray((item as { tarefas?: unknown }).tarefas)
      )
    : [];

  return {
    produto: typeof raw.produto === "string" ? raw.produto : "—",
    oferta: typeof raw.oferta === "string" ? raw.oferta : "—",
    pdf: typeof raw.pdf === "string" ? raw.pdf : "—",
    landing: typeof raw.landing === "string" ? raw.landing : "—",
    estrategia: typeof raw.estrategia === "string" ? raw.estrategia : "—",
    campanha_meta: typeof raw.campanha_meta === "string" ? raw.campanha_meta : "—",
    publico: typeof raw.publico === "string" ? raw.publico : "—",
    cronograma: cronograma.map((item) => ({
      dia: item.dia,
      foco: item.foco,
      tarefas: item.tarefas.filter((t): t is string => typeof t === "string"),
    })),
  };
}

export function computeSmartLaunchDashboard(
  sessions: AuraSmartLaunchSession[]
): SmartLaunchDashboardMetrics {
  const prepared = sessions.filter((s) => s.status === "prepared");
  const scores = prepared
    .map((s) => parseSmartLaunchScore(s.smart_score)?.score_geral ?? 0)
    .filter((n) => n > 0);

  const investimentos = prepared
    .map((s) => Number(s.orcamento_disponivel ?? 0))
    .filter((n) => n > 0);

  const melhor = [...prepared].sort((a, b) => {
    const scoreA = parseSmartLaunchScore(a.smart_score)?.score_geral ?? 0;
    const scoreB = parseSmartLaunchScore(b.smart_score)?.score_geral ?? 0;
    return scoreB - scoreA;
  })[0];

  return {
    sessoesTotal: sessions.length,
    melhorScore: scores.length > 0 ? Math.max(...scores) : 0,
    investimentoMedio:
      investimentos.length > 0
        ? Math.round(investimentos.reduce((a, b) => a + b, 0) / investimentos.length)
        : 0,
    ultimoProduto: melhor?.resumo?.slice(0, 60) ?? "—",
    modoSeguro: SMART_LAUNCH_SAFE_MODE && META_READ_ONLY_MODE,
  };
}

export function buildSmartLaunchAuraContext(
  session: AuraSmartLaunchSession | null,
  bundle: CreatorProductBundle | null
): string {
  if (!session) return "Nenhuma sessão Smart Launch ativa.";

  const score = parseSmartLaunchScore(session.smart_score);
  const outputs = parseSmartLaunchOutputs(session.generated_outputs);
  const locale = {
    target_country: session.target_country,
    target_language: session.target_language,
    currency: session.currency,
  };

  return [
    `Tipo: ${session.product_type === "afiliado" ? "Produto afiliado" : "Produto próprio"}`,
    `Mercado: ${session.target_country} · ${session.target_language} · ${session.currency}`,
    `Meta financeira: ${formatCreatorMoney(Number(session.meta_financeira ?? 0), locale)}`,
    `Orçamento: ${formatCreatorMoney(Number(session.orcamento_disponivel ?? 0), locale)}`,
    `Status: ${session.status} · Etapa ${session.current_step}/4`,
    `Modo seguro: ${session.safe_mode ? "ATIVO" : "desativado"}`,
    bundle ? `Produto: ${bundle.product.nome ?? "—"}` : null,
    score
      ? `Smart Score: ${score.score_geral}/100 · Sucesso ${score.probabilidade_sucesso}% · Risco ${score.risco} · ROI ${score.roi_estimado}% · ${score.tempo_estimado_dias} dias`
      : null,
    outputs?.estrategia ? `Estratégia: ${outputs.estrategia.slice(0, 120)}` : null,
    session.resumo ? `Resumo: ${session.resumo.slice(0, 200)}` : null,
    "Campanhas Meta: APENAS RASCUNHO — nenhuma publicação automática.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSmartLaunchCoachReply(params: {
  mode: SmartLaunchCoachMode;
  displayName: string;
  dashboard: SmartLaunchDashboardMetrics;
  sessions: AuraSmartLaunchSession[];
}): string {
  const { mode, displayName, dashboard, sessions } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;
  const prepared = sessions.filter((s) => s.status === "prepared");
  const best = [...prepared].sort((a, b) => {
    const scoreA = parseSmartLaunchScore(a.smart_score)?.score_geral ?? 0;
    const scoreB = parseSmartLaunchScore(b.smart_score)?.score_geral ?? 0;
    return scoreB - scoreA;
  })[0];
  const bestScore = best ? parseSmartLaunchScore(best.smart_score) : null;

  switch (mode) {
    case "smart-launch-prepare":
      return `${firstName}, acesse **Aura Smart Launch** (/dashboard/smart-launch) e siga o fluxo em 4 etapas:

**1.** Produto próprio ou afiliado
**2.** País, idioma e moeda
**3.** Meta financeira e orçamento
**4.** Clique em **Preparar Lançamento**

A IA orquestra todos os módulos em **modo seguro** — nada é publicado automaticamente.`;

    case "smart-launch-best":
      if (!best || !bestScore) {
        return `${firstName}, ainda não há lançamentos preparados. Acesse /dashboard/smart-launch e clique em **Preparar Lançamento**.`;
      }
      return `${firstName}, seu melhor lançamento:

**Smart Score:** ${bestScore.score_geral}/100
**Probabilidade de sucesso:** ${bestScore.probabilidade_sucesso}%
**Risco:** ${bestScore.risco}
**ROI estimado:** ${bestScore.roi_estimado}%
**Tempo estimado:** ${bestScore.tempo_estimado_dias} dias

${best.resumo ?? ""}

Detalhes em /dashboard/smart-launch`;

    case "smart-launch-invest":
      if (!best) {
        return `${firstName}, prepare um lançamento em /dashboard/smart-launch para calcular o investimento necessário com base no seu orçamento e meta financeira.`;
      }
      return `${firstName}, investimento do melhor lançamento:

**Orçamento disponível:** ${formatBRL(Number(best.orcamento_disponivel ?? 0))}
**Meta financeira:** ${formatBRL(Number(best.meta_financeira ?? 0))}
**Investimento médio (sessões):** ${dashboard.investimentoMedio > 0 ? formatBRL(dashboard.investimentoMedio) : "—"}

Modo seguro ativo — campanhas ficam em rascunho até sua aprovação manual.`;
  }
}

export function getRiskLabel(risco: SmartLaunchScore["risco"]): string {
  const labels: Record<SmartLaunchScore["risco"], string> = {
    baixo: "Baixo",
    medio: "Médio",
    alto: "Alto",
  };
  return labels[risco];
}

export function getRiskColor(risco: SmartLaunchScore["risco"]): string {
  const colors: Record<SmartLaunchScore["risco"], string> = {
    baixo: "text-emerald-300",
    medio: "text-amber-300",
    alto: "text-rose-300",
  };
  return colors[risco];
}

export function defaultSmartLaunchIntake(): SmartLaunchIntake {
  return {
    product_type: "proprio",
    ideia: "",
    nicho: "",
    publico: "",
    ...DEFAULT_CREATOR_LOCALE,
    meta_financeira: 10000,
    orcamento_disponivel: 2000,
  };
}

export { GLOBAL_OBJECTIVES as SMART_LAUNCH_PRODUCT_TYPES };

export function mergeCronogramaFromOrchestration(
  session: AuraSmartLaunchSession
): SmartLaunchGeneratedOutputs["cronograma"] {
  const outputs = parseSmartLaunchOutputs(session.generated_outputs);
  if (outputs?.cronograma.length) return outputs.cronograma;

  const plan = parseOrchestratorLaunchPlan(
    (session.generated_outputs as { orchestrator_plan?: unknown })?.orchestrator_plan
  );
  return plan?.cronograma ?? [];
}
