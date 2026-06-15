import type { AuraSmartLaunchSession } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { formatBRL } from "@/utils/creator";
import { formatCreatorMoney } from "@/utils/creator-locale";
import type { DailyBriefing } from "@/utils/execution";
import { META_READ_ONLY_MODE } from "@/utils/meta-intelligence";
import type { PerformancePanel } from "@/utils/performance";
import type { RevenueDashboardMetrics } from "@/utils/revenue";
import { SMART_LAUNCH_SAFE_MODE } from "@/utils/smart-launch";

export const MISSION_CONTROL_SAFE_MODE = true;

export type MissionStepId = "produto" | "pdf" | "landing" | "kiwify" | "meta" | "performance";

export type MissionStepStatus = "nao_iniciado" | "em_andamento" | "concluido";

export const MISSION_PROGRESS_STEPS: { id: MissionStepId; label: string }[] = [
  { id: "produto", label: "Produto" },
  { id: "pdf", label: "PDF" },
  { id: "landing", label: "Landing" },
  { id: "kiwify", label: "Kiwify" },
  { id: "meta", label: "Meta" },
  { id: "performance", label: "Performance" },
];

export type MissionActive = {
  sessionId: string | null;
  nome: string;
  pais: string;
  idioma: string;
  moeda: string;
  metaFinanceira: number;
  metaFinanceiraFormatted: string;
  orcamento: number;
  orcamentoFormatted: string;
  productId: string | null;
};

export type MissionProgressItem = {
  id: MissionStepId;
  label: string;
  status: MissionStepStatus;
};

export type MissionRevenueSnapshot = {
  receitaAtual: number;
  receitaFormatted: string;
  investimento: number;
  investimentoFormatted: string;
  lucro: number;
  lucroFormatted: string;
  roi: number;
  roiFormatted: string;
};

export type MissionDailyAdvice = {
  conselhoCeo: string;
  projetoPrioritario: string;
  metaFinanceira: string;
  probabilidadeAtual: number | null;
  fonte: "execution" | "performance" | "ceo" | "fallback";
};

export type MissionPerformanceSnapshot = {
  maiorOportunidade: string;
  maiorRisco: string;
  recomendacao: string;
};

export type MissionControlDashboard = {
  activeMission: MissionActive | null;
  progress: MissionProgressItem[];
  revenue: MissionRevenueSnapshot | null;
  dailyAdvice: MissionDailyAdvice | null;
  performance: MissionPerformanceSnapshot | null;
  safeMode: {
    active: boolean;
    metaReadOnly: boolean;
    message: string;
  };
};

export const MISSION_CONTROL_AI_CONTEXT = `Você é a Aura Mission Control — central de operações do Smart Launch.
Consolide missão ativa, progresso, revenue, conselho CEO, execution e performance.
MODO SEGURO: NUNCA publique anúncios automaticamente. NUNCA aumente orçamento automaticamente.`;

export const MISSION_ACTIONS = [
  { id: "sync_kiwify", label: "Sincronizar Kiwify" },
  { id: "sync_meta", label: "Sincronizar Meta" },
  { id: "update_performance", label: "Atualizar Performance" },
  { id: "generate_creative", label: "Gerar novo criativo" },
  { id: "generate_copy", label: "Gerar nova copy" },
  { id: "generate_daily_advice", label: "Gerar conselho diário" },
] as const;

export type MissionActionId = (typeof MISSION_ACTIONS)[number]["id"];

export function getMissionStepStatusLabel(status: MissionStepStatus): string {
  const labels: Record<MissionStepStatus, string> = {
    nao_iniciado: "Não iniciado",
    em_andamento: "Em andamento",
    concluido: "Concluído",
  };
  return labels[status];
}

export function getMissionStepStatusColor(status: MissionStepStatus): string {
  const colors: Record<MissionStepStatus, string> = {
    nao_iniciado: "text-zinc-500 bg-zinc-700/30",
    em_andamento: "text-amber-300 bg-amber-500/15",
    concluido: "text-emerald-300 bg-emerald-500/15",
  };
  return colors[status];
}

export function buildMissionActive(
  session: AuraSmartLaunchSession | null,
  bundle: CreatorProductBundle | null
): MissionActive | null {
  if (!session) return null;

  const locale = {
    target_country: session.target_country,
    target_language: session.target_language,
    currency: session.currency,
  };

  const meta = Number(session.meta_financeira ?? 0);
  const orc = Number(session.orcamento_disponivel ?? 0);

  return {
    sessionId: session.id,
    nome:
      bundle?.product.nome ??
      session.resumo?.slice(0, 80) ??
      session.ideia?.slice(0, 80) ??
      session.nicho ??
      "Missão Smart Launch",
    pais: session.target_country,
    idioma: session.target_language,
    moeda: session.currency,
    metaFinanceira: meta,
    metaFinanceiraFormatted: formatCreatorMoney(meta, locale),
    orcamento: orc,
    orcamentoFormatted: formatCreatorMoney(orc, locale),
    productId: session.product_id,
  };
}

export function computeMissionProgress(params: {
  session: AuraSmartLaunchSession | null;
  factoryStatus?: string | null;
  kiwifyConnected?: boolean;
  kiwifyProductsCount?: number;
  metaConnected?: boolean;
  hasPerformanceReport?: boolean;
}): MissionProgressItem[] {
  const { session, factoryStatus, kiwifyConnected, kiwifyProductsCount, metaConnected, hasPerformanceReport } =
    params;

  if (!session) {
    return MISSION_PROGRESS_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      status: "nao_iniciado" as MissionStepStatus,
    }));
  }

  const preparing = session.status === "preparing";
  const prepared = session.status === "prepared";

  function step(
    id: MissionStepId,
    label: string,
    concluido: boolean,
    emAndamento: boolean
  ): MissionProgressItem {
    let status: MissionStepStatus = "nao_iniciado";
    if (concluido) status = "concluido";
    else if (emAndamento || preparing) status = "em_andamento";
    return { id, label, status };
  }

  const pdfReady =
    factoryStatus === "pdf_ready" || factoryStatus === "published" || !!session.factory_id;
  const pdfStarted = !!session.factory_id || preparing;

  const kiwifyDone = Boolean(kiwifyConnected && (kiwifyProductsCount ?? 0) > 0);
  const kiwifyProgress = Boolean(kiwifyConnected);

  const metaDone = Boolean(session.ads_campaign_id || session.orchestration_id);
  const metaProgress = Boolean(metaConnected || preparing);

  const perfDone = Boolean(hasPerformanceReport && prepared);
  const perfProgress = Boolean(hasPerformanceReport || preparing);

  return [
    step("produto", "Produto", !!session.product_id && prepared, !!session.product_id || preparing),
    step("pdf", "PDF", pdfReady && prepared, pdfStarted),
    step("landing", "Landing", !!session.landing_id && prepared, !!session.landing_id || preparing),
    step("kiwify", "Kiwify", kiwifyDone, kiwifyProgress),
    step("meta", "Meta", metaDone, metaProgress),
    step("performance", "Performance", perfDone, perfProgress),
  ];
}

export function buildMissionRevenueSnapshot(
  revenue: RevenueDashboardMetrics | null,
  missionOrcamento: number | null
): MissionRevenueSnapshot | null {
  if (!revenue) return null;

  const receita = revenue.lucro.receita.month;
  const investimento =
    missionOrcamento && missionOrcamento > 0
      ? missionOrcamento
      : revenue.lucro.despesas.month;
  const lucro = revenue.lucro.lucroLiquido.month;
  const roi = revenue.lucro.roiPct;

  return {
    receitaAtual: receita,
    receitaFormatted: formatBRL(receita),
    investimento,
    investimentoFormatted: formatBRL(investimento),
    lucro,
    lucroFormatted: formatBRL(lucro),
    roi,
    roiFormatted: `${roi}%`,
  };
}

export function buildMissionDailyAdvice(params: {
  briefing: DailyBriefing | null;
  panel: PerformancePanel | null;
  missaoDoDia?: string | null;
  projetoPrincipal?: string | null;
}): MissionDailyAdvice {
  const { briefing, panel, missaoDoDia, projetoPrincipal } = params;

  if (briefing?.conselho_ceo) {
    return {
      conselhoCeo: briefing.conselho_ceo,
      projetoPrioritario: briefing.projeto_prioritario ?? projetoPrincipal ?? "—",
      metaFinanceira: briefing.meta_financeira ?? "—",
      probabilidadeAtual: briefing.probabilidade_atual ?? null,
      fonte: "execution",
    };
  }

  if (panel?.conselhoCeo) {
    return {
      conselhoCeo: panel.conselhoCeo,
      projetoPrioritario: panel.melhorProjeto ?? projetoPrincipal ?? "—",
      metaFinanceira: "—",
      probabilidadeAtual: null,
      fonte: "performance",
    };
  }

  if (missaoDoDia) {
    return {
      conselhoCeo: missaoDoDia,
      projetoPrioritario: projetoPrincipal ?? "—",
      metaFinanceira: "—",
      probabilidadeAtual: null,
      fonte: "ceo",
    };
  }

  return {
    conselhoCeo:
      "Acesse o Smart Launch, prepare uma missão e gere o plano diário no Execution para receber conselho personalizado.",
    projetoPrioritario: "—",
    metaFinanceira: "—",
    probabilidadeAtual: null,
    fonte: "fallback",
  };
}

export function buildMissionPerformanceSnapshot(
  panel: PerformancePanel | null
): MissionPerformanceSnapshot | null {
  if (!panel) return null;

  return {
    maiorOportunidade: panel.maiorOportunidade || "—",
    maiorRisco: panel.maiorRisco || "—",
    recomendacao: panel.conselhoCeo || "—",
  };
}

export function computeMissionControlDashboard(params: {
  session: AuraSmartLaunchSession | null;
  bundle: CreatorProductBundle | null;
  revenue: RevenueDashboardMetrics | null;
  briefing: DailyBriefing | null;
  panel: PerformancePanel | null;
  missaoDoDia?: string | null;
  projetoPrincipal?: string | null;
  factoryStatus?: string | null;
  kiwifyConnected?: boolean;
  kiwifyProductsCount?: number;
  metaConnected?: boolean;
  hasPerformanceReport?: boolean;
}): MissionControlDashboard {
  const activeMission = buildMissionActive(params.session, params.bundle);

  return {
    activeMission,
    progress: computeMissionProgress({
      session: params.session,
      factoryStatus: params.factoryStatus,
      kiwifyConnected: params.kiwifyConnected,
      kiwifyProductsCount: params.kiwifyProductsCount,
      metaConnected: params.metaConnected,
      hasPerformanceReport: params.hasPerformanceReport,
    }),
    revenue: buildMissionRevenueSnapshot(
      params.revenue,
      activeMission?.orcamento ?? null
    ),
    dailyAdvice: buildMissionDailyAdvice({
      briefing: params.briefing,
      panel: params.panel,
      missaoDoDia: params.missaoDoDia,
      projetoPrincipal: params.projetoPrincipal,
    }),
    performance: buildMissionPerformanceSnapshot(params.panel),
    safeMode: {
      active: MISSION_CONTROL_SAFE_MODE && SMART_LAUNCH_SAFE_MODE,
      metaReadOnly: META_READ_ONLY_MODE,
      message:
        "Modo seguro ativo — anúncios não são publicados e orçamento não é aumentado automaticamente.",
    },
  };
}

export function buildMissionControlAuraContext(dashboard: MissionControlDashboard): string {
  const m = dashboard.activeMission;
  const lines = [
    "### Aura Mission Control",
    m
      ? `Missão: ${m.nome} · ${m.pais} · ${m.moeda} · Meta ${m.metaFinanceiraFormatted} · Orçamento ${m.orcamentoFormatted}`
      : "Nenhuma missão ativa.",
    `Progresso: ${dashboard.progress.map((p) => `${p.label}=${getMissionStepStatusLabel(p.status)}`).join(", ")}`,
    dashboard.revenue
      ? `Revenue: receita ${dashboard.revenue.receitaFormatted} · lucro ${dashboard.revenue.lucroFormatted} · ROI ${dashboard.revenue.roiFormatted}`
      : null,
    dashboard.dailyAdvice?.conselhoCeo
      ? `Conselho CEO: ${dashboard.dailyAdvice.conselhoCeo.slice(0, 200)}`
      : null,
    dashboard.safeMode.message,
  ];
  return lines.filter(Boolean).join("\n");
}
