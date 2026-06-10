import type { AdsObjetivo, AdsOrcamentoNivel, CreatorAdsCampaign } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import {
  buildBudgetAskReply,
  buildBudgetSuggestion,
} from "@/utils/campaign-budget";
import { formatBRL } from "@/utils/creator";

import type { CreatorLocalePartial } from "@/utils/creator-locale";

export type AdsIntake = {
  nome: string;
  avatar: string;
  problema: string;
  solucao: string;
  promessa: string;
  diferencial: string;
  preco: number | null;
  product_id?: string | null;
  copylab_id?: string | null;
  asset_id?: string | null;
  landing_id?: string | null;
  campaign_id?: string | null;
  objetivo?: AdsObjetivo | null;
  orcamento_nivel?: AdsOrcamentoNivel | null;
  orcamento_disponivel?: number | null;
} & CreatorLocalePartial;

export type AdsPublicoTipo = "interesse" | "lookalike" | "remarketing";

export type AdsPublico = {
  tipo: AdsPublicoTipo;
  nome: string;
  targeting: string;
  justificativa: string;
};

export type AdsConjunto = {
  nome: string;
  publico: string;
  orcamento_diario: number;
  posicionamentos: string;
  estrategia: string;
};

export type AdsAnuncio = {
  nome: string;
  headline: string;
  texto_principal: string;
  descricao: string;
  cta: string;
  formato: string;
  conjunto: string;
};

export type GeneratedAdsCampaign = {
  objetivo: AdsObjetivo;
  orcamento_nivel: AdsOrcamentoNivel;
  investimento_diario_min: number;
  investimento_diario_max: number;
  investimento_mensal_previsto: number;
  campanha_nome: string;
  campanha_estrategia: string;
  publicos: AdsPublico[];
  conjuntos_anuncios: AdsConjunto[];
  anuncios: AdsAnuncio[];
};

export type AdsDashboardMetrics = {
  totalCampanhas: number;
  ultimoProduto: string;
  emRascunho: number;
  comCriativos: number;
  comLanding: number;
};

export const ADS_OBJETIVOS: { id: AdsObjetivo; label: string }[] = [
  { id: "conversao", label: "Conversão" },
  { id: "leads", label: "Leads" },
  { id: "trafego", label: "Tráfego" },
  { id: "engajamento", label: "Engajamento" },
];

export const ADS_ORCAMENTO_NIVEIS: {
  id: AdsOrcamentoNivel;
  label: string;
  description: string;
}[] = [
  { id: "baixo", label: "Baixo", description: "Teste inicial — escala conforme orçamento" },
  { id: "medio", label: "Médio", description: "Validação — múltiplos criativos/públicos" },
  { id: "escala", label: "Escala", description: "Crescimento — estrutura ampliada" },
];

export const ADS_AI_CONTEXT = `Você é a Aura Ads Manager — estrategista de tráfego pago para mercados globais.
Monte campanhas em RASCUNHO com país, idioma, moeda, público local e orçamento na moeda escolhida.
Sugira objetivo, públicos (interesse, lookalike, remarketing) e orçamento realista.
NUNCA publique — apenas estruture o plano de mídia.`;

export const ADS_IA_ACTIONS = [
  {
    id: "criar-campanha",
    label: "Criar campanha",
    prompt: "Crie uma campanha de tráfego pago completa para meu produto.",
  },
  {
    id: "sugerir-publico",
    label: "Sugerir público",
    prompt: "Qual público devo usar para anunciar meu produto?",
  },
  {
    id: "sugerir-investimento",
    label: "Quanto investir",
    prompt: "Quanto devo investir em anúncios para meu produto?",
  },
] as const;

const ADS_CREATE_PHRASES = [
  "crie uma campanha",
  "criar uma campanha",
  "crie campanha",
  "criar campanha",
  "gere uma campanha",
] as const;

const ADS_AUDIENCE_PHRASES = [
  "qual publico devo usar",
  "qual público devo usar",
  "que publico usar",
  "que público usar",
  "sugerir publico",
  "sugerir público",
] as const;

const ADS_BUDGET_PHRASES = [
  "quanto investir",
  "quanto devo investir",
  "quanto gastar",
  "quanto devo gastar",
  "qual orcamento",
  "qual orçamento",
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

export type AdsCoachMode = "ads-create" | "ads-audience" | "ads-budget";

export function detectAdsCoachMode(message: string): AdsCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, ADS_BUDGET_PHRASES)) return "ads-budget";
  if (matchesAny(normalized, ADS_AUDIENCE_PHRASES)) return "ads-audience";
  if (matchesAny(normalized, ADS_CREATE_PHRASES)) return "ads-create";
  return null;
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): AdsIntake {
  const { product } = bundle;
  const preco = product.faixa_preco_max ?? product.faixa_preco_min ?? null;

  return {
    nome: product.nome ?? "",
    avatar: product.avatar ?? "",
    problema: product.problema ?? "",
    solucao: product.solucao ?? "",
    promessa: product.promessa ?? "",
    diferencial: product.diferenciais ?? "",
    preco,
    product_id: product.id,
    copylab_id: null,
    asset_id: null,
    landing_id: null,
    objetivo: null,
    orcamento_nivel: null,
    orcamento_disponivel: null,
  };
}

export function parsePublicos(json: unknown): AdsPublico[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (item): item is AdsPublico =>
      typeof item === "object" &&
      item !== null &&
      "tipo" in item &&
      "nome" in item &&
      typeof (item as AdsPublico).nome === "string"
  );
}

export function parseConjuntos(json: unknown): AdsConjunto[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (item): item is AdsConjunto =>
      typeof item === "object" &&
      item !== null &&
      "nome" in item &&
      typeof (item as AdsConjunto).nome === "string"
  );
}

export function parseAnuncios(json: unknown): AdsAnuncio[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (item): item is AdsAnuncio =>
      typeof item === "object" &&
      item !== null &&
      "nome" in item &&
      typeof (item as AdsAnuncio).nome === "string"
  );
}

export function computeAdsDashboard(records: CreatorAdsCampaign[]): AdsDashboardMetrics {
  const ultimo = records[0];
  return {
    totalCampanhas: records.length,
    ultimoProduto: ultimo?.nome ?? "—",
    emRascunho: records.filter((r) => r.status === "draft").length,
    comCriativos: records.filter((r) => r.asset_id).length,
    comLanding: records.filter((r) => r.landing_id).length,
  };
}

export function buildAdsAuraContext(records: CreatorAdsCampaign[]): string {
  if (records.length === 0) return "Nenhuma campanha no Ads Manager.";

  return records
    .slice(0, 5)
    .map((r) => {
      const obj = ADS_OBJETIVOS.find((o) => o.id === r.objetivo)?.label ?? r.objetivo ?? "—";
      const inv = r.investimento_mensal_previsto
        ? formatBRL(r.investimento_mensal_previsto) + "/mês"
        : "—";
      return `• ${r.nome ?? r.campanha_nome ?? "Campanha"} — ${obj} · ${inv} · rascunho`;
    })
    .join("\n");
}

export function getObjetivoLabel(objetivo: AdsObjetivo | null | undefined): string {
  return ADS_OBJETIVOS.find((o) => o.id === objetivo)?.label ?? objetivo ?? "—";
}

export function getOrcamentoLabel(nivel: AdsOrcamentoNivel | null | undefined): string {
  return ADS_ORCAMENTO_NIVEIS.find((o) => o.id === nivel)?.label ?? nivel ?? "—";
}

export function formatInvestimentoRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${formatBRL(min)} – ${formatBRL(max)}/dia`;
  if (min != null) return `a partir de ${formatBRL(min)}/dia`;
  return `até ${formatBRL(max!)}/dia`;
}

export function buildAdsCoachReply(params: {
  mode: AdsCoachMode;
  displayName: string;
  records: CreatorAdsCampaign[];
  bundles: CreatorProductBundle[];
}): string {
  const { mode, displayName, records, bundles } = params;
  const greeting = displayName ? `${displayName}, ` : "";
  const latest = records[0];

  if (mode === "ads-create") {
    if (latest?.campanha_nome) {
      return `${greeting}você já tem campanha em rascunho: **${latest.campanha_nome}**

**Objetivo:** ${getObjetivoLabel(latest.objetivo)}
**Investimento previsto:** ${latest.investimento_mensal_previsto ? formatBRL(latest.investimento_mensal_previsto) + "/mês" : "—"}

Abra **Aura Ads Manager** (/dashboard/creator/ads) para editar ou criar nova.`;
    }

    const product = bundles[0]?.product;
    return `${greeting}para criar uma campanha:

1. Abra **Aura Ads Manager** → /dashboard/creator/ads
2. Vincule produto, criativo (Studio) e landing (Builder)
3. Clique em **Gerar campanha**

${product ? `Produto disponível: **${product.nome}**` : "Crie um produto no Creator primeiro."}

Modo atual: **apenas rascunho** — nada é publicado automaticamente.`;
  }

  if (mode === "ads-audience") {
    if (latest) {
      const publicos = parsePublicos(latest.publicos);
      if (publicos.length > 0) {
        const list = publicos
          .map((p) => `• **${p.tipo}** — ${p.nome}: ${p.justificativa.slice(0, 100)}`)
          .join("\n");
        return `${greeting}públicos sugeridos para **${latest.nome ?? "campanha"}**:

${list}

Abra o Ads Manager para ver targeting completo.`;
      }
    }

    return `${greeting}para sugerir públicos, gere uma campanha em **Ads Manager** (/dashboard/creator/ads).

A IA sugere:
• **Interesse** — cold audience por nicho
• **Lookalike** — similar à sua base
• **Remarketing** — quem já interagiu`;
  }

  if (mode === "ads-budget") {
    const budget = latest?.orcamento_disponivel ?? null;
    if (budget != null && Number(budget) > 0) {
      return `${greeting}com base no seu orçamento de **${formatBRL(Number(budget))}**:

${buildBudgetSuggestion(Number(budget))}

**Campanha:** ${latest.nome ?? "rascunho"}
**Diário sugerido:** ${formatInvestimentoRange(latest.investimento_diario_min, latest.investimento_diario_max)}
**Mensal previsto:** ${latest.investimento_mensal_previsto ? formatBRL(latest.investimento_mensal_previsto) : "—"}

Abra o Ads Manager para ajustar ou gerar nova campanha.`;
    }

    return buildBudgetAskReply(displayName);
  }

  return `${greeting}abra o Ads Manager em /dashboard/creator/ads.`;
}

export { formatBRL };
