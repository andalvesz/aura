import type {
  ExcellenceAssetType,
  QualityReview,
  QualityScore,
  SpecialistSlug,
} from "@/types/database";
import {
  SPECIALIST_LABELS,
  SPECIALIST_SLUGS,
  SPECIALIST_APPROVE_THRESHOLD,
  SPECIALIST_PREMIUM_THRESHOLD,
  SPECIALIST_REGENERATE_THRESHOLD,
  calculateSpecialistFinalScore,
  evaluateSpecialistByCriteria,
  getSpecialistDefinition,
  getSpecialistsForAssetType,
  resolveSpecialistStatus,
  type SpecialistReviewPayload,
  type ExcellenceReviewStatus,
  clampScore,
} from "@/utils/specialist-engine";

export const EXCELLENCE_APPROVE_THRESHOLD = SPECIALIST_APPROVE_THRESHOLD;
export const EXCELLENCE_PREMIUM_THRESHOLD = SPECIALIST_PREMIUM_THRESHOLD;
export const EXCELLENCE_REGENERATE_THRESHOLD = SPECIALIST_REGENERATE_THRESHOLD;

export const EXCELLENCE_SAFE_MODE = {
  active: true,
  message:
    "Nenhum ativo gerado pela Aura pode ser entregue sem passar pela auditoria de especialistas do Specialist Engine.",
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

export const EXCELLENCE_REVIEWERS: SpecialistSlug[] = SPECIALIST_SLUGS;

export const EXCELLENCE_REVIEWER_LABELS = SPECIALIST_LABELS;

export type ExcellenceReviewer = SpecialistSlug;

export type { ExcellenceReviewStatus, SpecialistReviewPayload };
export { clampScore };

export { MARKET_LEADER_MODE, computeMarketLeaderFinalScore } from "@/utils/market-leader";

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
  excellenceScore: number | null;
  benchmarkScore: number | null;
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

export function getReviewersForAssetType(
  assetType: ExcellenceAssetType
): Array<{ reviewer: SpecialistSlug; weight: number }> {
  return getSpecialistsForAssetType(assetType).map((entry) => ({
    reviewer: entry.specialist.slug,
    weight: entry.weight,
  }));
}

export function resolveExcellenceStatus(finalScore: number): ExcellenceReviewStatus {
  return resolveSpecialistStatus(finalScore);
}

export function calculateFinalScore(
  reviews: Array<Pick<SpecialistReviewPayload, "reviewer" | "score">>,
  assetType: ExcellenceAssetType
): number {
  return calculateSpecialistFinalScore(reviews, assetType);
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
      excellenceScore: score.excellence_score,
      benchmarkScore: score.benchmark_score,
      approved: score.approved,
      status,
      regenerationCount: score.regeneration_count,
      updatedAt: score.updated_at,
    };
  });

  const approved = cards.filter(
    (card) => card.approved || card.status === "approved" || card.status === "premium"
  );
  const rejected = cards.filter((card) => !card.approved && card.status === "blocked");
  const regenerate = cards.filter((card) => card.status === "regenerate");

  const mediaGeral =
    cards.length > 0
      ? clampScore(cards.reduce((sum, card) => sum + card.finalScore, 0) / cards.length)
      : 0;

  const sorted = [...cards].sort((a, b) => b.finalScore - a.finalScore);
  const melhoresAtivos = sorted
    .filter((card) => card.finalScore >= EXCELLENCE_APPROVE_THRESHOLD)
    .slice(0, 5);
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
  raw: Partial<SpecialistReviewPayload> & { reviewer: SpecialistSlug }
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
  reviewer: SpecialistSlug,
  content: string,
  assetType: ExcellenceAssetType
): SpecialistReviewPayload {
  const specialist = getSpecialistDefinition(reviewer);
  if (!specialist) {
    return normalizeSpecialistReview({
      reviewer,
      score: 50,
      strengths: [],
      weaknesses: ["Especialista não configurado."],
      recommendations: ["Configure o Specialist Engine."],
    });
  }
  const detail = evaluateSpecialistByCriteria(specialist, content, assetType);
  return {
    reviewer: detail.reviewer,
    score: detail.score,
    strengths: detail.strengths,
    weaknesses: detail.weaknesses,
    recommendations: detail.recommendations,
  };
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
    case "premium":
      return "Premium";
    case "approved":
      return "Aprovado";
    case "regenerate":
      return "Melhorar";
    case "blocked":
      return "Bloqueado";
  }
}

export function excellenceStatusColor(status: ExcellenceReviewStatus): string {
  switch (status) {
    case "premium":
      return "text-violet-400";
    case "approved":
      return "text-emerald-400";
    case "regenerate":
      return "text-amber-400";
    case "blocked":
      return "text-rose-400";
  }
}
