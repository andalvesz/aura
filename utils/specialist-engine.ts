import type { ExcellenceAssetType, Specialist, SpecialistSlug } from "@/types/database";
import type { BenchmarkComparisonResult } from "@/utils/market-leader";
import { computeMarketLeaderFinalScore } from "@/utils/market-leader";

export const SPECIALIST_PREMIUM_THRESHOLD = 90;
export const SPECIALIST_APPROVE_THRESHOLD = 85;
export const SPECIALIST_REGENERATE_THRESHOLD = 70;

export type ExcellenceReviewStatus = "premium" | "approved" | "regenerate" | "blocked";

export type SpecialistReviewPayload = {
  reviewer: SpecialistSlug;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

export const SPECIALIST_ENGINE_SAFE_MODE = {
  active: true,
  message:
    "Todos os módulos Aura consultam especialistas persistentes antes de aprovar ou entregar qualquer ativo.",
};

export const SPECIALIST_SLUGS: SpecialistSlug[] = [
  "product_strategist",
  "copy_chief",
  "creative_director",
  "media_buyer",
  "offer_architect",
  "landing_expert",
  "consumer_psychologist",
  "growth_strategist",
];

export const SPECIALIST_LABELS: Record<SpecialistSlug, string> = {
  product_strategist: "Product Strategist",
  copy_chief: "Copy Chief",
  creative_director: "Creative Director",
  media_buyer: "Media Buyer",
  offer_architect: "Offer Architect",
  landing_expert: "Landing Expert",
  consumer_psychologist: "Consumer Psychologist",
  growth_strategist: "Growth Strategist",
};

export type SpecialistDefinition = {
  slug: SpecialistSlug;
  name: string;
  description: string;
  criteria: string[];
  assetTypes: ExcellenceAssetType[];
  defaultWeight: number;
  persona: string;
};

export type SpecialistCriterionScore = {
  criterion: string;
  score: number;
  note: string;
};

export type SpecialistReviewDetail = SpecialistReviewPayload & {
  criteriaScores: SpecialistCriterionScore[];
};

export type SpecialistConsultResult = {
  assetType: ExcellenceAssetType;
  assetId: string;
  label: string;
  specialists: SpecialistDefinition[];
  reviews: SpecialistReviewDetail[];
  excellenceScore: number;
  benchmarkScore: number;
  benchmarkComparison: BenchmarkComparisonResult | null;
  finalScore: number;
  status: ExcellenceReviewStatus;
  approved: boolean;
};

export type SpecialistGateResult = {
  allowed: boolean;
  error: string | null;
  result: SpecialistConsultResult | null;
};

export const SPECIALIST_DEFINITIONS: SpecialistDefinition[] = [
  {
    slug: "product_strategist",
    name: "Product Strategist",
    description: "Valida posicionamento, avatar, promessa e coerência do produto com o mercado.",
    criteria: [
      "Clareza de avatar e dor principal",
      "Promessa específica e crível",
      "Diferenciação vs concorrentes",
      "Ticket alinhado ao valor percebido",
      "Escalabilidade do produto",
    ],
    assetTypes: ["product", "ebook", "offer", "strategy"],
    defaultWeight: 0.2,
    persona: "Estrategista de produto digital — foco em fit mercado-produto e monetização.",
  },
  {
    slug: "copy_chief",
    name: "Copy Chief",
    description: "Audita headline, narrativa, bullets, CTA e persuasão ética.",
    criteria: [
      "Headline com benefício claro",
      "Mecanismo único explícito",
      "Bullets orientados a resultado",
      "CTA direto e específico",
      "Tom consistente com avatar",
    ],
    assetTypes: ["copy", "landing", "offer", "creative", "campaign"],
    defaultWeight: 0.2,
    persona: "Diretor de copy — rigoroso com clareza, gancho e conversão honesta.",
  },
  {
    slug: "creative_director",
    name: "Creative Director",
    description: "Avalia hook visual, coerência criativa e aderência ao briefing.",
    criteria: [
      "Hook visual nos primeiros 3 segundos",
      "Coerência com promessa do produto",
      "Formato adequado ao canal",
      "Legibilidade e contraste",
      "Variações testáveis",
    ],
    assetTypes: ["creative", "campaign", "landing"],
    defaultWeight: 0.175,
    persona: "Diretor criativo — padrão premium para criativos e peças visuais.",
  },
  {
    slug: "media_buyer",
    name: "Media Buyer",
    description: "Analisa estrutura de campanha, público, budget e escalabilidade de mídia.",
    criteria: [
      "Objetivo de campanha claro",
      "Segmentação coerente com avatar",
      "Budget realista para teste",
      "Criativos alinhados ao funil",
      "Métricas de controle definidas",
    ],
    assetTypes: ["campaign", "creative", "strategy"],
    defaultWeight: 0.175,
    persona: "Media buyer sênior — foco em ROAS, testes e escala segura.",
  },
  {
    slug: "offer_architect",
    name: "Offer Architect",
    description: "Valida stack de ofertas, pricing, bumps, upsells e valor percebido.",
    criteria: [
      "Stack coerente com ticket front-end",
      "Order bump com take rate realista",
      "Upsell complementar (não redundante)",
      "Downsell para recuperação",
      "AOV projetado sustentável",
    ],
    assetTypes: ["offer", "funnel", "product", "strategy"],
    defaultWeight: 0.2,
    persona: "Arquiteto de ofertas — maximiza AOV sem quebrar confiança.",
  },
  {
    slug: "landing_expert",
    name: "Landing Expert",
    description: "Audita estrutura de página, fluxo de conversão e elementos de prova.",
    criteria: [
      "Above-the-fold com promessa + CTA",
      "Prova social ou autoridade",
      "Seção de benefícios escaneável",
      "FAQ/objeções respondidas",
      "Mobile-first e velocidade percebida",
    ],
    assetTypes: ["landing", "funnel", "copy"],
    defaultWeight: 0.2,
    persona: "Especialista em landing pages — conversão estrutural e UX de vendas.",
  },
  {
    slug: "consumer_psychologist",
    name: "Consumer Psychologist",
    description: "Avalia gatilhos mentais, objeções, urgência e ética persuasiva.",
    criteria: [
      "Dor e desejo bem mapeados",
      "Objeções antecipadas",
      "Prova que reduz risco percebido",
      "Urgência legítima (sem fake scarcity)",
      "Linguagem empática com avatar",
    ],
    assetTypes: ["copy", "landing", "offer", "creative", "product", "ebook"],
    defaultWeight: 0.175,
    persona: "Psicólogo do consumidor — persuasão baseada em comportamento real.",
  },
  {
    slug: "growth_strategist",
    name: "Growth Strategist",
    description: "Valida escalabilidade, loops de crescimento, LTV e compliance de growth.",
    criteria: [
      "Loop de aquisição-retenção claro",
      "Métricas norte definidas",
      "Risco regulatório/compliance",
      "Potencial de escala por canal",
      "Aprendizado iterativo (test-learn)",
    ],
    assetTypes: ["strategy", "funnel", "campaign", "offer", "product"],
    defaultWeight: 0.175,
    persona: "Growth strategist — escala sustentável e compliance em growth.",
  },
];

const SPECIALIST_WEIGHTS: Record<ExcellenceAssetType, Partial<Record<SpecialistSlug, number>>> = {
  product: {
    product_strategist: 0.25,
    consumer_psychologist: 0.2,
    copy_chief: 0.15,
    growth_strategist: 0.2,
    offer_architect: 0.2,
  },
  ebook: {
    product_strategist: 0.2,
    copy_chief: 0.2,
    consumer_psychologist: 0.2,
    growth_strategist: 0.2,
    landing_expert: 0.2,
  },
  copy: {
    copy_chief: 0.3,
    consumer_psychologist: 0.25,
    landing_expert: 0.2,
    growth_strategist: 0.25,
  },
  creative: {
    creative_director: 0.3,
    copy_chief: 0.2,
    media_buyer: 0.2,
    consumer_psychologist: 0.15,
    growth_strategist: 0.15,
  },
  landing: {
    landing_expert: 0.3,
    copy_chief: 0.2,
    consumer_psychologist: 0.15,
    creative_director: 0.15,
    growth_strategist: 0.2,
  },
  offer: {
    offer_architect: 0.3,
    copy_chief: 0.2,
    product_strategist: 0.15,
    consumer_psychologist: 0.15,
    growth_strategist: 0.2,
  },
  funnel: {
    offer_architect: 0.25,
    landing_expert: 0.25,
    growth_strategist: 0.25,
    product_strategist: 0.15,
    media_buyer: 0.1,
  },
  campaign: {
    media_buyer: 0.3,
    creative_director: 0.25,
    copy_chief: 0.15,
    growth_strategist: 0.15,
    offer_architect: 0.15,
  },
  strategy: {
    growth_strategist: 0.3,
    product_strategist: 0.25,
    offer_architect: 0.2,
    media_buyer: 0.15,
    landing_expert: 0.1,
  },
};

const CRITERION_SIGNALS: Record<SpecialistSlug, RegExp[]> = {
  product_strategist: [/avatar|nicho|público|produto|ticket|promessa|problema|solução/i],
  copy_chief: [/headline|cta|bullet|mecanismo|promessa|copy|subheadline/i],
  creative_director: [/visual|hook|thumb|imagem|criativo|formato|banner|reel/i],
  media_buyer: [/campanha|budget|orçamento|público|segment|meta|google|cpc|ctr/i],
  offer_architect: [/upsell|downsell|bump|oferta|preço|aov|stack|ticket/i],
  landing_expert: [/landing|headline|hero|faq|cta|above|prova|benefício/i],
  consumer_psychologist: [/dor|desejo|objeção|urgência|prova|garantia|medo|empat/i],
  growth_strategist: [/escala|ltv|roas|compliance|métrica|loop|retenção|growth/i],
};

export function specialistFromRow(row: Specialist): SpecialistDefinition {
  const criteria = Array.isArray(row.criteria)
    ? (row.criteria as unknown[]).filter((item): item is string => typeof item === "string")
    : [];

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    criteria: criteria.length ? criteria : (getSpecialistDefinition(row.slug)?.criteria ?? []),
    assetTypes: row.asset_types.filter((type): type is ExcellenceAssetType =>
      [
        "product",
        "ebook",
        "offer",
        "copy",
        "creative",
        "landing",
        "funnel",
        "campaign",
        "strategy",
      ].includes(type)
    ),
    defaultWeight: row.default_weight,
    persona: row.persona ?? "",
  };
}

export function getSpecialistDefinition(slug: SpecialistSlug): SpecialistDefinition | null {
  return SPECIALIST_DEFINITIONS.find((specialist) => specialist.slug === slug) ?? null;
}

export function getSpecialistsForAssetType(
  assetType: ExcellenceAssetType,
  catalog: SpecialistDefinition[] = SPECIALIST_DEFINITIONS
): Array<{ specialist: SpecialistDefinition; weight: number }> {
  const weights = SPECIALIST_WEIGHTS[assetType] ?? SPECIALIST_WEIGHTS.product;
  const applicable = catalog.filter((specialist) => specialist.assetTypes.includes(assetType));

  const entries = applicable.map((specialist) => ({
    specialist,
    weight: weights[specialist.slug] ?? specialist.defaultWeight,
  }));

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map((entry) => ({
    specialist: entry.specialist,
    weight: total > 0 ? entry.weight / total : entry.weight,
  }));
}

export function resolveSpecialistStatus(finalScore: number): ExcellenceReviewStatus {
  if (finalScore >= SPECIALIST_PREMIUM_THRESHOLD) return "premium";
  if (finalScore >= SPECIALIST_APPROVE_THRESHOLD) return "approved";
  if (finalScore >= SPECIALIST_REGENERATE_THRESHOLD) return "regenerate";
  return "blocked";
}

export function isSpecialistDeliveryAllowed(status: ExcellenceReviewStatus): boolean {
  return status === "premium" || status === "approved";
}

export function calculateSpecialistFinalScore(
  reviews: Array<Pick<SpecialistReviewPayload, "reviewer" | "score">>,
  assetType: ExcellenceAssetType
): number {
  const weights = getSpecialistsForAssetType(assetType);
  const weightMap = new Map(weights.map((entry) => [entry.specialist.slug, entry.weight]));

  let weightedSum = 0;
  let weightTotal = 0;

  for (const review of reviews) {
    const weight = weightMap.get(review.reviewer) ?? 0;
    if (weight <= 0) continue;
    weightedSum += clampScore(review.score) * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) {
    const avg = reviews.reduce((sum, review) => sum + clampScore(review.score), 0) / reviews.length;
    return clampScore(Number.isFinite(avg) ? avg : 0);
  }

  return clampScore(weightedSum / weightTotal);
}

function scoreCriterion(
  slug: SpecialistSlug,
  criterion: string,
  content: string,
  assetType: ExcellenceAssetType
): SpecialistCriterionScore {
  const lower = content.toLowerCase();
  const criterionLower = criterion.toLowerCase();
  const signals = CRITERION_SIGNALS[slug] ?? [];
  const keywordHit = signals.some((pattern) => pattern.test(content));
  const criterionWords = criterionLower.split(/\s+/).filter((word) => word.length > 4);
  const wordHits = criterionWords.filter((word) => lower.includes(word)).length;
  const ratio = criterionWords.length > 0 ? wordHits / criterionWords.length : 0;

  let score = 45 + ratio * 35;
  if (keywordHit) score += 12;
  if (content.trim().length > 200) score += 5;
  if (content.trim().length > 600) score += 5;
  if (/garantido|100%|milionário|sem esforço|renda passiva/i.test(content) && slug === "growth_strategist") {
    score -= 20;
  }

  void assetType;

  return {
    criterion,
    score: clampScore(score),
    note:
      score >= 75
        ? "Critério atendido com boa evidência no conteúdo."
        : "Critério parcialmente atendido — reforçar antes da entrega.",
  };
}

export function evaluateSpecialistByCriteria(
  specialist: SpecialistDefinition,
  content: string,
  assetType: ExcellenceAssetType
): SpecialistReviewDetail {
  const criteriaScores = specialist.criteria.map((criterion) =>
    scoreCriterion(specialist.slug, criterion, content, assetType)
  );

  const score =
    criteriaScores.length > 0
      ? clampScore(
          criteriaScores.reduce((sum, item) => sum + item.score, 0) / criteriaScores.length
        )
      : 0;

  const strengths = criteriaScores
    .filter((item) => item.score >= 75)
    .map((item) => `${item.criterion}: ${item.note}`)
    .slice(0, 3);

  const weaknesses = criteriaScores
    .filter((item) => item.score < SPECIALIST_APPROVE_THRESHOLD)
    .map((item) => `${item.criterion} (${item.score.toFixed(0)})`)
    .slice(0, 3);

  const recommendations = criteriaScores
    .filter((item) => item.score < SPECIALIST_APPROVE_THRESHOLD)
    .map((item) => `Melhorar: ${item.criterion}.`)
    .slice(0, 3);

  if (!recommendations.length && score < SPECIALIST_APPROVE_THRESHOLD) {
    recommendations.push("Revisar coerência geral antes de aprovar entrega.");
  }
  if (!recommendations.length) {
    recommendations.push("Manter monitoramento pós-publicação.");
  }

  return {
    reviewer: specialist.slug,
    score,
    strengths: strengths.length
      ? strengths
      : [`${specialist.name} identificou base válida para ${assetType}.`],
    weaknesses,
    recommendations,
    criteriaScores,
  };
}

export function normalizeAiSpecialistReview(
  specialist: SpecialistDefinition,
  raw: Partial<SpecialistReviewPayload> & {
    criteria_scores?: Array<{ criterion?: string; score?: number; note?: string }>;
  }
): SpecialistReviewDetail {
  const criteriaScores: SpecialistCriterionScore[] = Array.isArray(raw.criteria_scores)
    ? raw.criteria_scores
        .filter((item) => typeof item?.criterion === "string")
        .map((item) => ({
          criterion: item.criterion!,
          score: clampScore(Number(item.score ?? 0)),
          note: typeof item.note === "string" ? item.note : "Avaliado pela IA.",
        }))
    : specialist.criteria.map((criterion) => ({
        criterion,
        score: clampScore(Number(raw.score ?? 0)),
        note: "Score agregado da IA.",
      }));

  return {
    reviewer: specialist.slug,
    score: clampScore(Number(raw.score ?? 0)),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.filter(Boolean).slice(0, 5) : [],
    weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.filter(Boolean).slice(0, 5) : [],
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.filter(Boolean).slice(0, 5)
      : [],
    criteriaScores,
  };
}

export function buildSpecialistConsultResult(params: {
  assetType: ExcellenceAssetType;
  assetId: string;
  label: string;
  reviews: SpecialistReviewDetail[];
  specialists: SpecialistDefinition[];
  benchmarkComparison?: BenchmarkComparisonResult | null;
}): SpecialistConsultResult {
  const payloadReviews = params.reviews.map(({ criteriaScores, ...review }) => review);
  const excellenceScore = calculateSpecialistFinalScore(payloadReviews, params.assetType);
  const benchmarkScore = params.benchmarkComparison?.benchmark_score ?? 0;
  const finalScore =
    params.benchmarkComparison != null
      ? computeMarketLeaderFinalScore(excellenceScore, benchmarkScore)
      : excellenceScore;
  const status = resolveSpecialistStatus(finalScore);

  return {
    assetType: params.assetType,
    assetId: params.assetId,
    label: params.label,
    specialists: params.specialists,
    reviews: params.reviews,
    excellenceScore,
    benchmarkScore: params.benchmarkComparison != null ? benchmarkScore : 0,
    benchmarkComparison: params.benchmarkComparison ?? null,
    finalScore,
    status,
    approved: isSpecialistDeliveryAllowed(status),
  };
}

export function buildSpecialistGateError(result: SpecialistConsultResult, module?: string): string {
  const moduleLabel = module ? ` (${module})` : "";
  const topWeakness = result.reviews
    .flatMap((review) => review.weaknesses)
    .slice(0, 2)
    .join("; ");

  if (result.status === "blocked") {
    return `Entrega bloqueada pelo Aura Excellence Engine${moduleLabel}. Score ${result.finalScore.toFixed(1)} (< 70). ${topWeakness || "Revise o ativo."}`;
  }

  if (result.status === "regenerate") {
    return `Ativo requer melhoria automática${moduleLabel}. Score ${result.finalScore.toFixed(1)} (70–84). ${topWeakness || "Aplique as recomendações dos especialistas."}`;
  }

  if (!result.approved) {
    return `Ativo não aprovado pelo Aura Excellence Engine${moduleLabel}. Score mínimo: ${SPECIALIST_APPROVE_THRESHOLD}.`;
  }

  if (result.status === "premium") {
    return "Ativo premium — aprovado para entrega.";
  }

  return "Ativo aprovado pelo Aura Excellence Engine.";
}

export function buildSpecialistAuraContext(catalog: SpecialistDefinition[]): string {
  return [
    "=== Aura Specialist Engine ===",
    ...catalog.map(
      (specialist) =>
        `${specialist.name}: ${specialist.criteria.slice(0, 3).join("; ")}`
    ),
  ].join("\n");
}

export type AssetApprovalCheck = {
  assetType: ExcellenceAssetType;
  assetId: string;
  label?: string;
};

export function collectOperationAssetChecks(operation: {
  id: string;
  product_id: string | null;
  copylab_id: string | null;
  assets_id: string | null;
  landing_id: string | null;
  orchestration_id: string | null;
}): AssetApprovalCheck[] {
  const checks: AssetApprovalCheck[] = [];

  if (operation.product_id) {
    checks.push({ assetType: "product", assetId: operation.product_id });
  }
  if (operation.copylab_id) {
    checks.push({ assetType: "copy", assetId: operation.copylab_id });
  }
  if (operation.landing_id) {
    checks.push({ assetType: "landing", assetId: operation.landing_id });
  }
  if (operation.assets_id) {
    checks.push({ assetType: "creative", assetId: operation.assets_id });
  }
  if (operation.orchestration_id) {
    checks.push({ assetType: "campaign", assetId: operation.orchestration_id });
  }

  checks.push({ assetType: "strategy", assetId: operation.id, label: "Operação" });
  return checks;
}
