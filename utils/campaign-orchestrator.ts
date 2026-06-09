import type {
  CreatorAdsCampaign,
  CreatorAsset,
  CreatorCampaignOrchestration,
  CreatorCopylab,
  CreatorLanding,
  CreatorResearch,
} from "@/types/database";
import {
  computeChecklistProgress,
  formatBRL,
  type CreatorProductBundle,
} from "@/utils/creator";

export type OrchestratorStep =
  | "pesquisa"
  | "produto"
  | "copy"
  | "criativos"
  | "landing"
  | "campanha";

export type OrchestratorStepStatus = "concluido" | "pendente" | "bloqueado";

export const ORCHESTRATOR_STEPS: { id: OrchestratorStep; label: string }[] = [
  { id: "pesquisa", label: "Pesquisa" },
  { id: "produto", label: "Produto" },
  { id: "copy", label: "Copy" },
  { id: "criativos", label: "Criativos" },
  { id: "landing", label: "Landing" },
  { id: "campanha", label: "Campanha" },
];

export const ORCHESTRATOR_STEP_LINKS: Record<OrchestratorStep, string> = {
  pesquisa: "/dashboard/creator/research",
  produto: "/dashboard/creator",
  copy: "/dashboard/creator/copy",
  criativos: "/dashboard/creator/studio",
  landing: "/dashboard/creator/landing",
  campanha: "/dashboard/creator/ads",
};

export type OrchestratorIntake = {
  product_id: string;
  orchestration_id?: string | null;
};

export type OrchestratorConnections = {
  research_id: string | null;
  copylab_id: string | null;
  asset_id: string | null;
  landing_id: string | null;
  ads_campaign_id: string | null;
};

export type OrchestratorLaunchPlan = {
  titulo: string;
  fases: { nome: string; duracao_dias: number; acoes: string[] }[];
  cronograma: { dia: number; foco: string; tarefas: string[] }[];
  prioridades: string[];
};

export type GeneratedOrchestration = {
  score_lancamento: number;
  probabilidade_sucesso: number;
  investimento_necessario: number;
  receita_prevista: number;
  roi_estimado: number;
  orcamento_sugerido: {
    nivel: string;
    diario_min: number;
    diario_max: number;
    mensal: number;
    justificativa: string;
  };
  plano_lancamento: OrchestratorLaunchPlan;
  riscos: { nivel: "baixo" | "medio" | "alto"; descricao: string; mitigacao: string }[];
  resumo: string;
};

export type OrchestratorDashboardMetrics = {
  scoreLancamento: number;
  probabilidadeSucesso: number;
  investimentoNecessario: number;
  receitaPrevista: number;
  roiEstimado: number;
  produtoAtual: string;
  etapasConcluidas: number;
  etapasTotal: number;
};

export type OrchestratorCenterData = {
  bundle: CreatorProductBundle | null;
  checklist: Record<OrchestratorStep, OrchestratorStepStatus>;
  research: CreatorResearch | null;
  copy: CreatorCopylab | null;
  asset: CreatorAsset | null;
  landing: CreatorLanding | null;
  adsCampaign: CreatorAdsCampaign | null;
  orchestration: CreatorCampaignOrchestration | null;
};

export const ORCHESTRATOR_AI_CONTEXT = `Você é a Aura Campaign Orchestrator — orquestra Research, Creator, CopyLab, Creative Studio, Landing Builder e Ads Manager em uma campanha pronta para lançamento.
Conecte criativos, landing e anúncios; calcule orçamento, ROI e plano de lançamento.
NUNCA publique anúncios — apenas prepare a estrutura em rascunho. Português do Brasil.`;

export const ORCHESTRATOR_IA_ACTIONS = [
  {
    id: "falta-lancar",
    label: "O que falta para lançar?",
    prompt: "O que falta para lançar?",
  },
  {
    id: "produto-pronto",
    label: "Meu produto está pronto?",
    prompt: "Meu produto está pronto?",
  },
  {
    id: "risco-lancamento",
    label: "Qual risco do lançamento?",
    prompt: "Qual risco do lançamento?",
  },
] as const;

const ORCHESTRATOR_MISSING_PHRASES = [
  "o que falta para lancar",
  "o que falta pra lancar",
  "falta para lancar",
] as const;

const ORCHESTRATOR_READY_PHRASES = [
  "meu produto esta pronto",
  "produto esta pronto",
  "produto pronto",
  "esta pronto para lancar",
] as const;

const ORCHESTRATOR_RISK_PHRASES = [
  "qual risco do lancamento",
  "qual o risco",
  "risco do lancamento",
  "riscos do lancamento",
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

export type OrchestratorCoachMode = "orchestrator-missing" | "orchestrator-ready" | "orchestrator-risk";

export function detectOrchestratorCoachMode(message: string): OrchestratorCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, ORCHESTRATOR_RISK_PHRASES)) return "orchestrator-risk";
  if (matchesAny(normalized, ORCHESTRATOR_READY_PHRASES)) return "orchestrator-ready";
  if (matchesAny(normalized, ORCHESTRATOR_MISSING_PHRASES)) return "orchestrator-missing";
  return null;
}

function isProdutoConcluido(bundle: CreatorProductBundle): boolean {
  return (
    !!bundle.validation ||
    ["validacao", "producao", "pagina_vendas", "criativos", "lancamento", "trafego", "escala"].includes(
      bundle.product.status
    )
  );
}

export function resolveOrchestratorChecklist(
  bundle: CreatorProductBundle,
  research: CreatorResearch | null,
  copy: CreatorCopylab | null,
  asset: CreatorAsset | null,
  landing: CreatorLanding | null,
  adsCampaign: CreatorAdsCampaign | null
): Record<OrchestratorStep, OrchestratorStepStatus> {
  const produtoOk = isProdutoConcluido(bundle);
  const pesquisaOk = !!research;
  const copyOk = !!copy || !!bundle.offer;
  const criativosOk = !!asset;
  const landingOk = !!landing || !!copy?.pagina_vendas;
  const campanhaOk = !!adsCampaign;

  const checklist: Record<OrchestratorStep, OrchestratorStepStatus> = {
    pesquisa: pesquisaOk ? "concluido" : "pendente",
    produto: produtoOk ? "concluido" : "pendente",
    copy: copyOk ? "concluido" : produtoOk ? "pendente" : "bloqueado",
    criativos: criativosOk ? "concluido" : copyOk ? "pendente" : "bloqueado",
    landing: landingOk ? "concluido" : copyOk ? "pendente" : "bloqueado",
    campanha:
      campanhaOk
        ? "concluido"
        : landingOk && criativosOk
          ? "pendente"
          : "bloqueado",
  };

  return checklist;
}

export function buildOrchestratorCenterData(
  bundles: CreatorProductBundle[],
  researchRecords: CreatorResearch[],
  copyRecords: CreatorCopylab[],
  assets: CreatorAsset[],
  landings: CreatorLanding[],
  adsCampaigns: CreatorAdsCampaign[],
  orchestrations: CreatorCampaignOrchestration[],
  productId?: string | null
): OrchestratorCenterData {
  const bundle = productId
    ? (bundles.find((b) => b.product.id === productId) ?? null)
    : (bundles[0] ?? null);

  if (!bundle) {
    return {
      bundle: null,
      checklist: {
        pesquisa: "bloqueado",
        produto: "bloqueado",
        copy: "bloqueado",
        criativos: "bloqueado",
        landing: "bloqueado",
        campanha: "bloqueado",
      },
      research: null,
      copy: null,
      asset: null,
      landing: null,
      adsCampaign: null,
      orchestration: orchestrations[0] ?? null,
    };
  }

  const pid = bundle.product.id;
  const research = researchRecords.find((r) => r.product_id === pid) ?? null;
  const copy = copyRecords.find((c) => c.product_id === pid) ?? null;
  const asset = assets.find((a) => a.product_id === pid) ?? null;
  const landing = landings.find((l) => l.product_id === pid) ?? null;
  const adsCampaign = adsCampaigns.find((a) => a.product_id === pid) ?? null;
  const orchestration =
    orchestrations.find((o) => o.product_id === pid) ?? orchestrations[0] ?? null;

  const checklist = resolveOrchestratorChecklist(
    bundle,
    research,
    copy,
    asset,
    landing,
    adsCampaign
  );

  return { bundle, checklist, research, copy, asset, landing, adsCampaign, orchestration };
}

export function computeOrchestratorDashboard(
  center: OrchestratorCenterData
): OrchestratorDashboardMetrics {
  const bundle = center.bundle;
  const checklistValues = Object.values(center.checklist);
  const etapasConcluidas = checklistValues.filter((s) => s === "concluido").length;

  const orch = center.orchestration;
  const validationScore = bundle?.validation?.nota_final ?? 0;
  const checklist = bundle
    ? computeChecklistProgress(bundle.checklist, bundle.product.status)
    : { percent: 0 };

  const scoreLancamento =
    orch?.score_lancamento ??
    Math.round((etapasConcluidas / ORCHESTRATOR_STEPS.length) * 40 + validationScore * 0.4 + checklist.percent * 0.2);

  const probabilidadeSucesso =
    orch?.probabilidade_sucesso ??
    Math.min(95, Math.round(scoreLancamento * 0.85 + etapasConcluidas * 3));

  const investimento =
    orch?.investimento_necessario ??
    center.adsCampaign?.investimento_mensal_previsto ??
    0;

  const receita =
    orch?.receita_prevista ??
    bundle?.product.receita_prevista ??
    bundle?.launch?.potencial_estimado ??
    0;

  const roi =
    orch?.roi_estimado ??
    (investimento > 0 ? Math.round(((Number(receita) - investimento) / investimento) * 100) : 0);

  return {
    scoreLancamento: Number(scoreLancamento),
    probabilidadeSucesso: Number(probabilidadeSucesso),
    investimentoNecessario: Number(investimento),
    receitaPrevista: Number(receita),
    roiEstimado: Number(roi),
    produtoAtual: bundle?.product.nome ?? "—",
    etapasConcluidas,
    etapasTotal: ORCHESTRATOR_STEPS.length,
  };
}

export function buildOrchestratorAuraContext(
  center: OrchestratorCenterData,
  orchestrations: CreatorCampaignOrchestration[]
): string {
  if (!center.bundle) return "Nenhum produto selecionado para orquestração.";

  const { bundle, checklist, research, copy, asset, landing, adsCampaign, orchestration } = center;
  const pending = ORCHESTRATOR_STEPS.filter((s) => checklist[s.id] !== "concluido").map(
    (s) => `${s.label} (${checklist[s.id]})`
  );

  return [
    `Produto: ${bundle.product.nome ?? "—"}`,
    `Score validação: ${bundle.validation?.nota_final ?? "—"}/100`,
    `Etapas: ${Object.values(checklist).filter((s) => s === "concluido").length}/${ORCHESTRATOR_STEPS.length}`,
    `Pendente/bloqueado: ${pending.join(", ") || "nenhum"}`,
    research ? `Research: ${research.nicho ?? "vinculado"}` : "Research: pendente",
    copy ? `CopyLab: ${copy.headline?.slice(0, 50) ?? "gerada"}` : "CopyLab: pendente",
    asset ? `Creative Studio: ${asset.nome ?? "ativo"}` : "Criativos: pendente",
    landing ? `Landing: ${landing.headline?.slice(0, 50) ?? "gerada"}` : "Landing: pendente",
    adsCampaign
      ? `Ads: ${adsCampaign.campanha_nome ?? "rascunho"} · ${adsCampaign.investimento_mensal_previsto ? formatBRL(adsCampaign.investimento_mensal_previsto) + "/mês" : "—"}`
      : "Campanha: pendente",
    orchestration
      ? `Orquestração: score ${orchestration.score_lancamento ?? "—"} · ROI ${orchestration.roi_estimado ?? "—"}%`
      : "Orquestração: não preparada",
    `Total orquestrações: ${orchestrations.length}`,
    "Modo: APENAS PREPARAÇÃO — anúncios não são publicados.",
  ].join("\n");
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): OrchestratorIntake {
  return { product_id: bundle.product.id };
}

export function getStepStatusLabel(status: OrchestratorStepStatus): string {
  const labels: Record<OrchestratorStepStatus, string> = {
    concluido: "Concluído",
    pendente: "Pendente",
    bloqueado: "Bloqueado",
  };
  return labels[status];
}

export function parseOrchestratorLaunchPlan(json: unknown): OrchestratorLaunchPlan | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as OrchestratorLaunchPlan;
  if (!obj.titulo || !Array.isArray(obj.fases)) return null;
  return obj;
}

export function parseOrchestratorRisks(
  json: unknown
): { nivel: "baixo" | "medio" | "alto"; descricao: string; mitigacao: string }[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (item): item is { nivel: "baixo" | "medio" | "alto"; descricao: string; mitigacao: string } =>
      typeof item === "object" &&
      item !== null &&
      "descricao" in item &&
      typeof (item as { descricao: string }).descricao === "string"
  );
}

export { formatBRL };
