import { recordSystemLog } from "@/lib/logs/record";
import { QualityReviewsRepository, QualityScoresRepository } from "@/lib/supabase/repositories/aura-excellence.repository";
import type { ExcellenceAssetType, QualityReview, QualityScore } from "@/types/database";
import {
  buildExcellenceAssetLabel,
  buildExcellenceAuraContext,
  computeExcellenceDashboard,
  resolveExcellenceStatus,
  type ExcellenceDashboard,
  type ExcellenceIntake,
  type ExcellenceReviewResult,
} from "@/utils/aura-excellence";
import { calculateSpecialistFinalScore as calculateFinalScore } from "@/utils/specialist-engine";
import { loadAssetContent } from "./excellence-asset.loader";
import {
  reviewWithSpecialists,
} from "./specialist-engine.service";
import { getOptionalDataContext } from "./context";

async function reviewAssetInternal(
  assetType: ExcellenceAssetType,
  assetId: string,
  overrideContent?: string,
  overrideLabel?: string
): Promise<{ result: ExcellenceReviewResult | null; error: string | null }> {
  const { result, error } = await reviewWithSpecialists({
    asset_type: assetType,
    asset_id: assetId,
    content: overrideContent,
    label: overrideLabel,
    force_refresh: true,
  });

  if (error || !result) {
    return { result: null, error: error ?? "Erro na auditoria." };
  }

  const excellenceResult: ExcellenceReviewResult = {
    assetType,
    assetId,
    reviews: result.reviews.map((review) => ({
      reviewer: review.reviewer,
      score: review.score,
      strengths: review.strengths,
      weaknesses: review.weaknesses,
      recommendations: review.recommendations,
    })),
    finalScore: result.finalScore,
    status: result.status,
    approved: result.approved,
    regenerationCount: 0,
  };

  return { result: excellenceResult, error: null };
}

export async function reviewProduct(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("product", assetId, content, label);
}

export async function reviewCopy(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("copy", assetId, content, label);
}

export async function reviewCreative(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("creative", assetId, content, label);
}

export async function reviewLanding(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("landing", assetId, content, label);
}

export async function reviewOffer(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("offer", assetId, content, label);
}

export async function reviewFunnel(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("funnel", assetId, content, label);
}

export async function reviewCampaign(assetId: string, content?: string, label?: string) {
  return reviewAssetInternal("campaign", assetId, content, label);
}

export async function reviewAsset(input: ExcellenceIntake): Promise<{
  result: ExcellenceReviewResult | null;
  reviews: QualityReview[];
  score: QualityScore | null;
  error: string | null;
}> {
  const { result, reviews, score, error } = await reviewWithSpecialists({
    asset_type: input.asset_type,
    asset_id: input.asset_id,
    content: input.content,
    label: input.label,
    force_refresh: input.force_refresh,
  });

  if (error || !result) {
    return { result: null, reviews: reviews ?? [], score: score ?? null, error: error ?? "Erro na auditoria." };
  }

  return {
    result: {
      assetType: result.assetType,
      assetId: result.assetId,
      reviews: result.reviews.map((review) => ({
        reviewer: review.reviewer,
        score: review.score,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        recommendations: review.recommendations,
      })),
      finalScore: result.finalScore,
      status: result.status,
      approved: result.approved,
      regenerationCount: score?.regeneration_count ?? 0,
    },
    reviews: reviews ?? [],
    score: score ?? null,
    error: null,
  };
}

export { calculateFinalScore };

export async function approveAsset(
  assetType: ExcellenceAssetType,
  assetId: string
): Promise<{ score: QualityScore | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { score: null, error: "Usuário não autenticado." };

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const { data: existing, error: findError } = await scoresRepo.findByAsset(assetType, assetId);
  if (findError) return { score: null, error: findError };
  if (!existing) return { score: null, error: "Auditoria não encontrada." };
  if (existing.final_score < 85) {
    return { score: null, error: "Score insuficiente para aprovação manual (mínimo 85)." };
  }

  const { data, error } = await scoresRepo.update(existing.id, { approved: true });
  recordSystemLog({
    tipo: "info",
    modulo: "aura-excellence",
    mensagem: "Ativo aprovado manualmente",
    detalhes: { assetType, assetId, finalScore: existing.final_score },
  });
  return { score: data, error };
}

export async function rejectAsset(
  assetType: ExcellenceAssetType,
  assetId: string
): Promise<{ score: QualityScore | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { score: null, error: "Usuário não autenticado." };

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const { data: existing, error: findError } = await scoresRepo.findByAsset(assetType, assetId);
  if (findError) return { score: null, error: findError };
  if (!existing) return { score: null, error: "Auditoria não encontrada." };

  const { data, error } = await scoresRepo.update(existing.id, { approved: false });
  recordSystemLog({
    tipo: "warning",
    modulo: "aura-excellence",
    mensagem: "Ativo reprovado — entrega bloqueada",
    detalhes: { assetType, assetId, finalScore: existing.final_score },
  });
  return { score: data, error };
}

export async function requestRegeneration(
  assetType: ExcellenceAssetType,
  assetId: string
): Promise<{ score: QualityScore | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { score: null, error: "Usuário não autenticado." };

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const { data: existing, error: findError } = await scoresRepo.findByAsset(assetType, assetId);
  if (findError) return { score: null, error: findError };
  if (!existing) return { score: null, error: "Auditoria não encontrada." };

  const status = resolveExcellenceStatus(existing.final_score);
  if (status === "blocked") {
    return { score: null, error: "Ativo bloqueado — score abaixo de 70. Regeneração manual necessária." };
  }

  const { data, error } = await scoresRepo.update(existing.id, {
    approved: false,
    regeneration_count: existing.regeneration_count + 1,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "aura-excellence",
    mensagem: "Regeneração solicitada",
    detalhes: {
      assetType,
      assetId,
      finalScore: existing.final_score,
      regenerationCount: (existing.regeneration_count ?? 0) + 1,
    },
  });

  return { score: data, error };
}

export async function getExcellenceDashboard(): Promise<{
  dashboard: ExcellenceDashboard | null;
  scores: QualityScore[];
  reviews: QualityReview[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { dashboard: null, scores: [], reviews: [], error: "Usuário não autenticado." };
  }

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);

  const [{ data: scores, error: scoresError }, { data: reviews, error: reviewsError }] =
    await Promise.all([scoresRepo.findAllOrdered(), reviewsRepo.findRecent(500)]);

  if (scoresError || reviewsError) {
    return {
      dashboard: null,
      scores: [],
      reviews: [],
      error: scoresError ?? reviewsError ?? "Erro ao carregar Excellence Engine.",
    };
  }

  const labelMap: Record<string, string> = {};
  for (const score of scores ?? []) {
    const key = `${score.asset_type}:${score.asset_id}`;
    const { bundle } = await loadAssetContent(score.asset_type, score.asset_id);
    if (bundle?.label) labelMap[key] = bundle.label;
  }

  const dashboard = computeExcellenceDashboard(scores ?? [], labelMap);
  console.info("[aura-excellence] dashboard loaded", {
    total: dashboard.totalAuditorias,
    approved: dashboard.ativosAprovados,
    avg: dashboard.mediaGeral,
  });

  return {
    dashboard,
    scores: scores ?? [],
    reviews: reviews ?? [],
    error: null,
  };
}

export async function getExcellenceContext(): Promise<{ context: string; error: string | null }> {
  const { dashboard, error } = await getExcellenceDashboard();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar contexto." };
  return { context: buildExcellenceAuraContext(dashboard), error: null };
}

export type { ExcellenceDashboard, ExcellenceReviewResult, ExcellenceIntake };
