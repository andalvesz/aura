import type {
  ExcellenceAssetType,
  ExcellenceReviewer,
  QualityReview,
  QualityScore,
} from "@/types/database";

export const EXCELLENCE_SAFE_MODE = {
  active: true,
  message:
    "Nenhum ativo gerado pela Aura pode ser entregue sem passar pela auditoria de especialistas do Excellence Engine.",
};

export const EXCELLENCE_ASSET_TYPES: ExcellenceAssetType[] = [
  "product",
  "ebook",
  "offer",
  "copy",
  "creative",
  "landing",
  "funnel",
  "campaign",
  "strategy",
];

export const EXCELLENCE_ASSET_LABELS: Record<ExcellenceAssetType, string> = {
  product: "Produto",
  ebook: "E-book",
  offer: "Oferta",
  copy: "Copy",
  creative: "Criativo",
  landing: "Landing Page",
  funnel: "Funil",
  campaign: "Campanha",
  strategy: "Estratégia",
};

export const EXCELLENCE_REVIEWERS: ExcellenceReviewer[] = [
  "product_strategist",
  "copy_chief",
  "conversion_expert",
  "creative_director",
  "funnel_architect",
  "media_buyer",
  "consumer_psychologist",
  "compliance_reviewer",
];

export const EXCELLENCE_REVIEWER_LABELS: Record<ExcellenceReviewer, string> = {
  product_strategist: "Product Strategist",
  copy_chief: "Copy Chief",
  conversion_expert: "Conversion Expert",
  creative_director: "Creative Director",
  funnel_architect: "Funnel Architect",
  media_buyer: "Media Buyer",
  consumer_psychologist: "Consumer Psychologist",
  compliance_reviewer: "Compliance Reviewer",
};

export const EXCELLENCE_APPROVE_THRESHOLD = 85;
export const EXCELLENCE_REGENERATE_THRESHOLD = 70;

export type ExcellenceReviewStatus = "approved" | "regenerate" | "blocked";

export type SpecialistReviewPayload = {
  reviewer: ExcellenceReviewer;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type ExcellenceReviewResult = {
  assetType: ExcellenceAssetType;
  assetId: string;
  reviews: SpecialistReviewPayload[];
  finalScore: number;
  status: ExcellenceReviewStatus;
  approved: boolean;
  regenerationCount: number;
};

export type ExcellenceAssetCard = {
  assetType: ExcellenceAssetType;
  assetId: string;
  label: string;
  finalScore: number;
  approved: boolean;
  status: ExcellenceReviewStatus;
  regenerationCount: number;
  updatedAt: string;
};

export type ExcellenceDashboard = {
  ativosAprovados: number;
  ativosReprovados: number;
  mediaGeral: number;
  melhoresAtivos: ExcellenceAssetCard[];
  ativosParaMelhoria: ExcellenceAssetCard[];
  totalAuditorias: number;
  pendentesRegeneracao: number;
  bloqueados: number;
};

export type ExcellenceIntake = {
  asset_type: ExcellenceAssetType;
  asset_id: string;
  content?: string;
  label?: string;
  force_refresh?: boolean;
};

const REVIEWER_WEIGHTS: Record<ExcellenceAssetType, Partial<Record<ExcellenceReviewer, number>>> = {
  product: {
    product_strategist: 0.25,
    copy_chief: 0.15,
    conversion_expert: 0.2,
    consumer_psychologist: 0.2,
    compliance_reviewer: 0.2,
  },
  ebook: {
    product_strategist: 0.2,
    copy_chief: 0.2,
    conversion_expert: 0.15,
    consumer_psychologist: 0.2,
    compliance_reviewer: 0.25,
  },
  copy: {
    copy_chief: 0.3,
    conversion_expert: 0.25,
    consumer_psychologist: 0.25,
    compliance_reviewer: 0.2,
  },
  creative: {
    creative_director: 0.3,
    copy_chief: 0.2,
    conversion_expert: 0.2,
    media_buyer: 0.15,
    compliance_reviewer: 0.15,
  },
  landing: {
    conversion_expert: 0.25,
    copy_chief: 0.2,
    creative_director: 0.15,
    funnel_architect: 0.15,
    compliance_reviewer: 0.15,
    consumer_psychologist: 0.1,
  },
  offer: {
    product_strategist: 0.2,
    conversion_expert: 0.25,
    copy_chief: 0.2,
    consumer_psychologist: 0.15,
    compliance_reviewer: 0.2,
  },
  funnel: {
    funnel_architect: 0.3,
    conversion_expert: 0.25,
    product_strategist: 0.15,
    creative_director: 0.1,
    compliance_reviewer: 0.2,
  },
  campaign: {
    media_buyer: 0.3,
    creative_director: 0.2,
    conversion_expert: 0.2,
    copy_chief: 0.15,
    compliance_reviewer: 0.15,
  },
  strategy: {
    product_strategist: 0.25,
    funnel_architect: 0.25,
    conversion_expert: 0.2,
    media_buyer: 0.15,
    compliance_reviewer: 0.15,
  },
};

export function getReviewersForAssetType(
  assetType: ExcellenceAssetType
): Array<{ reviewer: ExcellenceReviewer; weight: number }> {
  const weights = REVIEWER_WEIGHTS[assetType] ?? REVIEWER_WEIGHTS.product;
  const entries = Object.entries(weights) as Array<[ExcellenceReviewer, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return entries.map(([reviewer, weight]) => ({
    reviewer,
    weight: total > 0 ? weight / total : weight,
  }));
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

export function resolveExcellenceStatus(finalScore: number): ExcellenceReviewStatus {
  if (finalScore >= EXCELLENCE_APPROVE_THRESHOLD) return "approved";
  if (finalScore >= EXCELLENCE_REGENERATE_THRESHOLD) return "regenerate";
  return "blocked";
}

export function calculateFinalScore(
  reviews: Array<Pick<SpecialistReviewPayload, "reviewer" | "score">>,
  assetType: ExcellenceAssetType
): number {
  const weights = getReviewersForAssetType(assetType);
  const weightMap = new Map(weights.map((entry) => [entry.reviewer, entry.weight]));

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

export function isAssetApproved(finalScore: number): boolean {
  return finalScore >= EXCELLENCE_APPROVE_THRESHOLD;
}

export function buildExcellenceAssetLabel(
  assetType: ExcellenceAssetType,
  assetId: string,
  label?: string | null
): string {
  if (label?.trim()) return label.trim();
  return `${EXCELLENCE_ASSET_LABELS[assetType]} · ${assetId.slice(0, 8)}`;
}

export function computeExcellenceDashboard(
  scores: QualityScore[],
  labels: Record<string, string> = {}
): ExcellenceDashboard {
  const cards: ExcellenceAssetCard[] = scores.map((score) => {
    const key = `${score.asset_type}:${score.asset_id}`;
    const status = resolveExcellenceStatus(score.final_score);
    return {
      assetType: score.asset_type,
      assetId: score.asset_id,
      label: labels[key] ?? buildExcellenceAssetLabel(score.asset_type, score.asset_id),
      finalScore: score.final_score,
      approved: score.approved,
      status,
      regenerationCount: score.regeneration_count,
      updatedAt: score.updated_at,
    };
  });

  const approved = cards.filter((card) => card.approved || card.status === "approved");
  const rejected = cards.filter((card) => !card.approved && card.status === "blocked");
  const regenerate = cards.filter((card) => card.status === "regenerate");

  const mediaGeral =
    cards.length > 0
      ? clampScore(cards.reduce((sum, card) => sum + card.finalScore, 0) / cards.length)
      : 0;

  const sorted = [...cards].sort((a, b) => b.finalScore - a.finalScore);
  const melhoresAtivos = sorted.filter((card) => card.finalScore >= EXCELLENCE_APPROVE_THRESHOLD).slice(0, 5);
  const ativosParaMelhoria = sorted
    .filter((card) => card.finalScore < EXCELLENCE_APPROVE_THRESHOLD)
    .slice(0, 5);

  return {
    ativosAprovados: approved.length,
    ativosReprovados: rejected.length,
    mediaGeral,
    melhoresAtivos,
    ativosParaMelhoria,
    totalAuditorias: cards.length,
    pendentesRegeneracao: regenerate.length,
    bloqueados: rejected.length,
  };
}

export function buildExcellenceAuraContext(dashboard: ExcellenceDashboard): string {
  return [
    "=== Aura Excellence Engine ===",
    `Ativos aprovados: ${dashboard.ativosAprovados}`,
    `Ativos reprovados/bloqueados: ${dashboard.ativosReprovados}`,
    `Média geral: ${dashboard.mediaGeral}`,
    `Pendentes de regeneração: ${dashboard.pendentesRegeneracao}`,
    dashboard.melhoresAtivos[0]
      ? `Melhor ativo: ${dashboard.melhoresAtivos[0].label} (${dashboard.melhoresAtivos[0].finalScore})`
      : "Melhor ativo: —",
    dashboard.ativosParaMelhoria[0]
      ? `Prioridade de melhoria: ${dashboard.ativosParaMelhoria[0].label} (${dashboard.ativosParaMelhoria[0].finalScore})`
      : "Prioridade de melhoria: —",
  ].join("\n");
}

export function normalizeSpecialistReview(
  raw: Partial<SpecialistReviewPayload> & { reviewer: ExcellenceReviewer }
): SpecialistReviewPayload {
  return {
    reviewer: raw.reviewer,
    score: clampScore(Number(raw.score ?? 0)),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.filter(Boolean).slice(0, 5) : [],
    weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.filter(Boolean).slice(0, 5) : [],
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.filter(Boolean).slice(0, 5)
      : [],
  };
}

export function heuristicSpecialistReview(
  reviewer: ExcellenceReviewer,
  content: string,
  assetType: ExcellenceAssetType
): SpecialistReviewPayload {
  const length = content.trim().length;
  const hasCta = /cta|compre|garanta|comece|inscreva|clique|saiba mais/i.test(content);
  const hasPromise = /promessa|resultado|transform|método|passo|solução/i.test(content);
  const hasComplianceRisk = /garantido|100%|enriqueça|milionário|sem esforço|renda passiva/i.test(content);

  let base = 55;
  if (length > 120) base += 8;
  if (length > 400) base += 7;
  if (hasCta) base += 6;
  if (hasPromise) base += 5;
  if (hasComplianceRisk) base -= 12;

  const reviewerBonus: Partial<Record<ExcellenceReviewer, number>> = {
    copy_chief: hasPromise ? 8 : -4,
    conversion_expert: hasCta ? 8 : -3,
    compliance_reviewer: hasComplianceRisk ? -15 : 10,
    creative_director: /visual|imagem|thumb|hook|headline/i.test(content) ? 8 : 0,
    funnel_architect: /funil|etapa|upsell|downsell|order bump/i.test(content) ? 10 : 0,
    media_buyer: /campanha|público|segmentação|criativo|budget/i.test(content) ? 8 : 0,
    product_strategist: /produto|avatar|nicho|ticket|oferta/i.test(content) ? 8 : 0,
    consumer_psychologist: /dor|desejo|objeção|prova|urgência/i.test(content) ? 8 : 0,
  };

  const score = clampScore(base + (reviewerBonus[reviewer] ?? 0));

  return normalizeSpecialistReview({
    reviewer,
    score,
    strengths:
      score >= 75
        ? [`${EXCELLENCE_REVIEWER_LABELS[reviewer]} identificou boa coerência para ${EXCELLENCE_ASSET_LABELS[assetType]}.`]
        : [`Base estrutural presente para ${EXCELLENCE_ASSET_LABELS[assetType]}.`],
    weaknesses:
      score < EXCELLENCE_APPROVE_THRESHOLD
        ? [`Score abaixo do padrão Excellence (${EXCELLENCE_APPROVE_THRESHOLD}+).`]
        : [],
    recommendations:
      score < EXCELLENCE_APPROVE_THRESHOLD
        ? ["Reforce clareza, prova e CTA antes da entrega."]
        : ["Ativo pronto para entrega com monitoramento pós-publicação."],
  });
}

export function reviewsToResult(
  assetType: ExcellenceAssetType,
  assetId: string,
  reviews: SpecialistReviewPayload[],
  regenerationCount = 0
): ExcellenceReviewResult {
  const finalScore = calculateFinalScore(reviews, assetType);
  const status = resolveExcellenceStatus(finalScore);
  return {
    assetType,
    assetId,
    reviews,
    finalScore,
    status,
    approved: status === "approved",
    regenerationCount,
  };
}

export function mergeQualityReviewRows(
  reviews: QualityReview[],
  score: QualityScore | null,
  label?: string
): ExcellenceReviewResult | null {
  if (!reviews.length && !score) return null;

  const assetType = score?.asset_type ?? reviews[0]?.asset_type;
  const assetId = score?.asset_id ?? reviews[0]?.asset_id;
  if (!assetType || !assetId) return null;

  const specialistReviews: SpecialistReviewPayload[] = reviews.map((review) => ({
    reviewer: review.reviewer,
    score: review.score,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    recommendations: review.recommendations,
  }));

  const result = reviewsToResult(
    assetType,
    assetId,
    specialistReviews,
    score?.regeneration_count ?? 0
  );

  if (score) {
    result.finalScore = score.final_score;
    result.approved = score.approved;
    result.status = resolveExcellenceStatus(score.final_score);
    result.regenerationCount = score.regeneration_count;
  }

  if (label) {
    void label;
  }

  return result;
}

export function formatExcellenceScore(score: number): string {
  return `${clampScore(score).toFixed(1)}`;
}

export function excellenceStatusLabel(status: ExcellenceReviewStatus): string {
  switch (status) {
    case "approved":
      return "Aprovado";
    case "regenerate":
      return "Regenerar";
    case "blocked":
      return "Bloqueado";
  }
}

export function excellenceStatusColor(status: ExcellenceReviewStatus): string {
  switch (status) {
    case "approved":
      return "text-emerald-400";
    case "regenerate":
      return "text-amber-400";
    case "blocked":
      return "text-rose-400";
  }
}
