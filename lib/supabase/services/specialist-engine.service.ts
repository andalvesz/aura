import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import {
  QualityReviewsRepository,
  QualityScoresRepository,
} from "@/lib/supabase/repositories/aura-excellence.repository";
import {
  SpecialistsRepository,
  mapSpecialistRows,
} from "@/lib/supabase/repositories/specialist-engine.repository";
import type { ExcellenceAssetType, Json, QualityReview, QualityScore, SpecialistSlug } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildExcellenceAssetLabel,
  clampScore,
  type ExcellenceIntake,
} from "@/utils/aura-excellence";
import {
  SPECIALIST_ENGINE_SAFE_MODE,
  buildSpecialistAuraContext,
  buildSpecialistConsultResult,
  buildSpecialistGateError,
  evaluateSpecialistByCriteria,
  getSpecialistsForAssetType,
  normalizeAiSpecialistReview,
  type AssetApprovalCheck,
  type SpecialistConsultResult,
  type SpecialistDefinition,
  type SpecialistGateResult,
  type SpecialistReviewDetail,
} from "@/utils/specialist-engine";
import { loadAssetContent } from "./excellence-asset.loader";
import { getOptionalDataContext } from "./context";

const SPECIALIST_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é o Aura Specialist Engine — painel de especialistas persistentes.
Cada especialista possui critérios próprios e deve retornar score 0–100, strengths, weaknesses, recommendations e criteria_scores.
Seja rigoroso: score >= 85 só para ativos realmente prontos para entrega.
Responda APENAS JSON conforme solicitado.`;

type AiSpecialistBundle = {
  reviews: Array<{
    reviewer: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    criteria_scores?: Array<{ criterion: string; score: number; note: string }>;
  }>;
};

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callSpecialistAi(user: string): Promise<AiSpecialistBundle | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.45,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<AiSpecialistBundle>(content);
}

export async function loadSpecialistCatalog(): Promise<{
  specialists: SpecialistDefinition[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { specialists: mapSpecialistRows(null), error: null };
  }

  const repo = new SpecialistsRepository(ctx.supabase);
  const { data, error } = await repo.findAllActive();
  if (error) {
    return { specialists: mapSpecialistRows(null), error };
  }

  return { specialists: mapSpecialistRows(data), error: null };
}

export async function runSpecialistPanelReview(
  assetType: ExcellenceAssetType,
  content: string,
  label: string,
  catalog?: SpecialistDefinition[]
): Promise<SpecialistReviewDetail[]> {
  const specialists = catalog ?? (await loadSpecialistCatalog()).specialists;
  const panel = getSpecialistsForAssetType(assetType, specialists);
  const slugs = panel.map((entry) => entry.specialist.slug);

  const prompt = [
    `Audite o ativo "${label}" (${assetType}).`,
    "",
    "Conteúdo:",
    content.slice(0, 6000),
    "",
    "Especialistas obrigatórios:",
    ...panel.map(
      (entry) =>
        `- ${entry.specialist.slug} (${entry.specialist.name}) — critérios: ${entry.specialist.criteria.join("; ")}`
    ),
    "",
    "Retorne JSON:",
    `{ "reviews": [{ "reviewer": "copy_chief", "score": 82, "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."], "criteria_scores": [{ "criterion": "...", "score": 80, "note": "..." }] }] }`,
    `Inclua exatamente um review por especialista: ${slugs.join(", ")}`,
  ].join("\n");

  const aiBundle = await callSpecialistAi(prompt);

  if (aiBundle?.reviews?.length) {
    const bySlug = new Map<string, SpecialistReviewDetail>();
    for (const raw of aiBundle.reviews) {
      const slug = raw.reviewer as SpecialistSlug;
      const specialist = panel.find((entry) => entry.specialist.slug === slug)?.specialist;
      if (!specialist) continue;
      bySlug.set(slug, normalizeAiSpecialistReview(specialist, { ...raw, reviewer: slug }));
    }

    return panel.map(
      (entry) =>
        bySlug.get(entry.specialist.slug) ??
        evaluateSpecialistByCriteria(entry.specialist, content, assetType)
    );
  }

  return panel.map((entry) =>
    evaluateSpecialistByCriteria(entry.specialist, content, assetType)
  );
}

export async function consultSpecialists(input: {
  assetType: ExcellenceAssetType;
  assetId: string;
  content: string;
  label?: string;
  catalog?: SpecialistDefinition[];
}): Promise<{ result: SpecialistConsultResult; error: string | null }> {
  const label = input.label?.trim() || buildExcellenceAssetLabel(input.assetType, input.assetId);
  const catalog = input.catalog ?? (await loadSpecialistCatalog()).specialists;
  const panel = getSpecialistsForAssetType(input.assetType, catalog);
  const reviews = await runSpecialistPanelReview(
    input.assetType,
    input.content,
    label,
    catalog
  );

  const result = buildSpecialistConsultResult({
    assetType: input.assetType,
    assetId: input.assetId,
    label,
    reviews,
    specialists: panel.map((entry) => entry.specialist),
  });

  return { result, error: null };
}

async function persistSpecialistReviews(
  result: SpecialistConsultResult,
  regenerationCount: number
): Promise<{ score: QualityScore | null; reviews: QualityReview[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { score: null, reviews: [], error: "Usuário não autenticado." };

  const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);
  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);

  await reviewsRepo.deleteByAsset(result.assetType, result.assetId);

  const reviewRows = result.reviews.map((review) => ({
    asset_type: result.assetType,
    asset_id: result.assetId,
    reviewer: review.reviewer,
    score: review.score,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    recommendations: review.recommendations,
    approved: review.score >= 85,
    metadata: {
      final_score: result.finalScore,
      status: result.status,
      criteria_scores: review.criteriaScores,
    } as Json,
  }));

  const { data: savedReviews, error: reviewsError } = await reviewsRepo.createMany(reviewRows);
  if (reviewsError) return { score: null, reviews: [], error: reviewsError };

  const { data: existing } = await scoresRepo.findByAsset(result.assetType, result.assetId);
  const nextRegeneration =
    result.status === "regenerate"
      ? (existing?.regeneration_count ?? regenerationCount) + 1
      : regenerationCount;

  const { data: score, error: scoreError } = await scoresRepo.upsertScore({
    asset_type: result.assetType,
    asset_id: result.assetId,
    final_score: result.finalScore,
    approved: result.approved,
    regeneration_count: nextRegeneration,
  });

  if (scoreError) return { score: null, reviews: savedReviews ?? [], error: scoreError };

  recordSystemLog({
    tipo: result.approved ? "info" : result.status === "regenerate" ? "warning" : "error",
    modulo: "specialist-engine",
    mensagem: `Painel de especialistas — ${result.assetType} score ${result.finalScore} (${result.status})`,
    detalhes: {
      assetType: result.assetType,
      assetId: result.assetId,
      finalScore: result.finalScore,
      status: result.status,
      specialists: result.reviews.map((review) => ({
        reviewer: review.reviewer,
        score: review.score,
      })),
    },
  });

  return { score, reviews: savedReviews ?? [], error: null };
}

export async function reviewWithSpecialists(
  input: ExcellenceIntake & { content?: string; label?: string }
): Promise<{
  result: SpecialistConsultResult | null;
  reviews: QualityReview[];
  score: QualityScore | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { result: null, reviews: [], score: null, error: "Usuário não autenticado." };
  }

  let content = input.content?.trim() ?? "";
  let label = input.label?.trim() ?? "";

  if (!content) {
    const { bundle, error } = await loadAssetContent(input.asset_type, input.asset_id);
    if (error || !bundle) {
      return { result: null, reviews: [], score: null, error: error ?? "Ativo não encontrado." };
    }
    content = bundle.content;
    label = bundle.label;
  } else {
    label = label || buildExcellenceAssetLabel(input.asset_type, input.asset_id);
  }

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);

  if (!input.force_refresh) {
    const [{ data: existingScore }, { data: existingReviews }] = await Promise.all([
      scoresRepo.findByAsset(input.asset_type, input.asset_id),
      reviewsRepo.findByAsset(input.asset_type, input.asset_id),
    ]);

    if (existingScore && existingReviews?.length) {
      const catalog = (await loadSpecialistCatalog()).specialists;
      const panel = getSpecialistsForAssetType(input.asset_type, catalog);
      const reviews: SpecialistReviewDetail[] = existingReviews.map((review) => ({
        reviewer: review.reviewer,
        score: review.score,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        recommendations: review.recommendations,
        criteriaScores: [],
      }));

      const result = buildSpecialistConsultResult({
        assetType: input.asset_type,
        assetId: input.asset_id,
        label,
        reviews,
        specialists: panel.map((entry) => entry.specialist),
      });
      result.finalScore = existingScore.final_score;
      result.approved = existingScore.approved;
      result.status =
        existingScore.final_score >= 90
          ? "premium"
          : existingScore.final_score >= 85
            ? "approved"
            : existingScore.final_score >= 70
              ? "regenerate"
              : "blocked";

      return {
        result,
        reviews: existingReviews,
        score: existingScore,
        error: null,
      };
    }
  }

  const { result, error: consultError } = await consultSpecialists({
    assetType: input.asset_type,
    assetId: input.asset_id,
    content,
    label,
  });

  if (consultError) {
    return { result: null, reviews: [], score: null, error: consultError };
  }

  const { data: existing } = await scoresRepo.findByAsset(input.asset_type, input.asset_id);
  const { score, reviews, error } = await persistSpecialistReviews(
    result,
    existing?.regeneration_count ?? 0
  );

  if (error) {
    return { result, reviews, score, error };
  }

  return { result, reviews, score, error: null };
}

export async function requireSpecialistApproval(
  assetType: ExcellenceAssetType,
  assetId: string,
  options?: {
    forceRefresh?: boolean;
    content?: string;
    label?: string;
    module?: string;
    skipSafeMode?: boolean;
  }
): Promise<SpecialistGateResult> {
  if (SPECIALIST_ENGINE_SAFE_MODE.active && !options?.skipSafeMode) {
    const { result, error } = await reviewWithSpecialists({
      asset_type: assetType,
      asset_id: assetId,
      content: options?.content,
      label: options?.label,
      force_refresh: options?.forceRefresh,
    });

    if (error || !result) {
      return { allowed: false, error: error ?? "Erro na consulta aos especialistas.", result: null };
    }

    const scoreRecordApproved =
      result.approved &&
      (result.status === "approved" || result.status === "premium");
    if (!scoreRecordApproved) {
      return {
        allowed: false,
        error: buildSpecialistGateError(result, options?.module),
        result,
      };
    }

    return { allowed: true, error: null, result };
  }

  return { allowed: true, error: null, result: null };
}

export async function requireMultipleSpecialistApprovals(
  checks: AssetApprovalCheck[],
  options?: { module?: string; forceRefresh?: boolean }
): Promise<SpecialistGateResult> {
  const failures: string[] = [];
  let lastResult: SpecialistConsultResult | null = null;

  for (const check of checks) {
    const gate = await requireSpecialistApproval(check.assetType, check.assetId, {
      module: options?.module,
      forceRefresh: options?.forceRefresh,
      label: check.label,
    });

    if (gate.result) lastResult = gate.result;
    if (!gate.allowed) {
      failures.push(gate.error ?? `Ativo ${check.assetType} reprovado.`);
    }
  }

  if (failures.length) {
    return {
      allowed: false,
      error: failures.join(" | "),
      result: lastResult,
    };
  }

  return { allowed: true, error: null, result: lastResult };
}

export async function getSpecialistEngineContext(): Promise<{ context: string; error: string | null }> {
  const { specialists, error } = await loadSpecialistCatalog();
  if (error) return { context: "", error };
  return { context: buildSpecialistAuraContext(specialists), error: null };
}

export async function scheduleSpecialistReview(
  assetType: ExcellenceAssetType,
  assetId: string,
  label?: string
): Promise<void> {
  void reviewWithSpecialists({
    asset_type: assetType,
    asset_id: assetId,
    label,
    force_refresh: true,
  }).catch(() => undefined);
}

export type {
  SpecialistConsultResult,
  SpecialistGateResult,
  SpecialistDefinition,
  AssetApprovalCheck,
};
