import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import {
  QualityReviewsRepository,
  QualityScoresRepository,
} from "@/lib/supabase/repositories/aura-excellence.repository";
import { AdCampaignsRepository } from "@/lib/supabase/repositories/ad-campaigns.repository";
import { CreatorCopylabRepository } from "@/lib/supabase/repositories/copylab.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import {
  ProductFactoryRepository,
} from "@/lib/supabase/repositories/product-factory.repository";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import type { ExcellenceAssetType, Json, QualityReview, QualityScore } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildExcellenceAssetLabel,
  buildExcellenceAuraContext,
  calculateFinalScore,
  computeExcellenceDashboard,
  EXCELLENCE_REVIEWER_LABELS,
  getReviewersForAssetType,
  heuristicSpecialistReview,
  isAssetApproved,
  normalizeSpecialistReview,
  resolveExcellenceStatus,
  reviewsToResult,
  type ExcellenceDashboard,
  type ExcellenceIntake,
  type ExcellenceReviewResult,
  type SpecialistReviewPayload,
} from "@/utils/aura-excellence";
import { getOptionalDataContext } from "./context";

const EXCELLENCE_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Excellence Engine — painel de especialistas virtuais que audita ativos antes da entrega.
Regras:
- Cada especialista avalia com score 0–100, pontos fortes, fracos e recomendações
- Seja rigoroso: score >= 85 só para ativos realmente prontos
- Compliance Reviewer deve penalizar promessas proibidas
- Responda APENAS JSON conforme solicitado.`;

type AiReviewBundle = {
  reviews: Array<{
    reviewer: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }>;
};

type AssetContentBundle = {
  content: string;
  label: string;
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

async function callExcellenceAi(user: string): Promise<AiReviewBundle | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: EXCELLENCE_SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<AiReviewBundle>(content);
}

async function loadAssetContent(
  assetType: ExcellenceAssetType,
  assetId: string
): Promise<{ bundle: AssetContentBundle | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };

  switch (assetType) {
    case "product": {
      const repo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Produto não encontrado." };
      return {
        bundle: {
          label: data.nome ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.nome ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Problema: ${data.problema ?? "—"}`,
            `Solução: ${data.solucao ?? "—"}`,
            `Público: ${data.publico_alvo ?? "—"}`,
            `Nicho: ${data.nicho ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "ebook": {
      const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "E-book não encontrado." };
      const conteudo =
        typeof data.conteudo === "string"
          ? data.conteudo
          : JSON.stringify(data.conteudo ?? {}).slice(0, 3000);
      return {
        bundle: {
          label: data.titulo ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.titulo ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Tipo: ${data.product_type ?? "ebook"}`,
            `Conteúdo: ${conteudo}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "copy": {
      const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Copy não encontrada." };
      return {
        bundle: {
          label: data.headline ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Headline: ${data.headline ?? "—"}`,
            `Subheadline: ${data.subheadline ?? "—"}`,
            `Bullets: ${Array.isArray(data.bullets) ? data.bullets.join("; ") : "—"}`,
            `CTA: ${data.cta ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Página de vendas: ${data.pagina_vendas ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "creative": {
      const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Criativo não encontrado." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Tipo: ${data.asset_type}`,
            `Título: ${data.title ?? "—"}`,
            `Copy: ${data.copy ?? "—"}`,
            `Prompt: ${data.prompt ?? "—"}`,
            `Formato: ${data.format ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "landing": {
      const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Landing page não encontrada." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.title ?? "—"}`,
            `Headline: ${data.headline ?? "—"}`,
            `Subheadline: ${data.subheadline ?? "—"}`,
            `CTA: ${data.cta_text ?? "—"}`,
            `Hero: ${data.hero_copy ?? "—"}`,
            `HTML: ${typeof data.html === "string" ? data.html.slice(0, 2000) : "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "offer": {
      const repo = new OffersRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Oferta não encontrada." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.title ?? "—"}`,
            `Tipo: ${data.offer_type}`,
            `Preço: ${data.price ?? "—"}`,
            `Descrição: ${data.description ?? "—"}`,
            `Take rate esperado: ${data.expected_take_rate ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "funnel": {
      const repo = new FunnelsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Funil não encontrado." };
      return {
        bundle: {
          label: data.funnel_name ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.funnel_name ?? "—"}`,
            `Tipo: ${data.funnel_type ?? "—"}`,
            `Nicho: ${data.niche ?? "—"}`,
            `Etapas: ${data.total_steps}`,
            `Conversão esperada: ${data.expected_conversion ?? "—"}`,
            `AOV esperado: ${data.expected_aov ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "campaign": {
      const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Campanha não encontrada." };
      return {
        bundle: {
          label: data.campaign_name ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.campaign_name ?? "—"}`,
            `Plataforma: ${data.platform}`,
            `Objetivo: ${data.objective ?? "—"}`,
            `Status: ${data.status}`,
            `Orçamento: ${data.budget ?? "—"}`,
            `Copy: ${JSON.stringify(data.copy_json ?? {}).slice(0, 2000)}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "strategy": {
      return {
        bundle: {
          label: buildExcellenceAssetLabel(assetType, assetId),
          content: `Estratégia registrada (ID: ${assetId}). Avalie coerência de posicionamento, funil e monetização.`,
        },
        error: null,
      };
    }
    default:
      return { bundle: null, error: "Tipo de ativo inválido." };
  }
}

async function runSpecialistReviews(
  assetType: ExcellenceAssetType,
  content: string,
  label: string
): Promise<SpecialistReviewPayload[]> {
  const reviewers = getReviewersForAssetType(assetType);
  const reviewerList = reviewers
    .map(
      (entry) =>
        `- ${entry.reviewer} (${EXCELLENCE_REVIEWER_LABELS[entry.reviewer]}, peso ${Math.round(entry.weight * 100)}%)`
    )
    .join("\n");

  const aiPrompt = [
    `Audite o ativo "${label}" (${assetType}).`,
    "",
    "Conteúdo:",
    content.slice(0, 6000),
    "",
    "Especialistas obrigatórios:",
    reviewerList,
    "",
    "Retorne JSON:",
    `{ "reviews": [{ "reviewer": "copy_chief", "score": 82, "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."] }] }`,
    "Inclua exatamente um review por especialista listado.",
  ].join("\n");

  const aiBundle = await callExcellenceAi(aiPrompt);
  const reviewerIds = reviewers.map((entry) => entry.reviewer);

  if (aiBundle?.reviews?.length) {
    const byReviewer = new Map<string, SpecialistReviewPayload>();
    for (const raw of aiBundle.reviews) {
      const reviewer = raw.reviewer as SpecialistReviewPayload["reviewer"];
      if (!reviewerIds.includes(reviewer)) continue;
      byReviewer.set(reviewer, normalizeSpecialistReview({ ...raw, reviewer }));
    }

    return reviewerIds.map(
      (reviewer) =>
        byReviewer.get(reviewer) ?? heuristicSpecialistReview(reviewer, content, assetType)
    );
  }

  return reviewerIds.map((reviewer) => heuristicSpecialistReview(reviewer, content, assetType));
}

async function persistReviewResult(
  assetType: ExcellenceAssetType,
  assetId: string,
  reviews: SpecialistReviewPayload[],
  regenerationCount: number
): Promise<{ score: QualityScore | null; reviews: QualityReview[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { score: null, reviews: [], error: "Usuário não autenticado." };

  const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);
  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);

  await reviewsRepo.deleteByAsset(assetType, assetId);

  const finalScore = calculateFinalScore(reviews, assetType);
  const approved = isAssetApproved(finalScore);
  const status = resolveExcellenceStatus(finalScore);

  const reviewRows = reviews.map((review) => ({
    asset_type: assetType,
    asset_id: assetId,
    reviewer: review.reviewer,
    score: review.score,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    recommendations: review.recommendations,
    approved: review.score >= 85,
    metadata: {
      final_score: finalScore,
      status,
    } as Json,
  }));

  const { data: savedReviews, error: reviewsError } = await reviewsRepo.createMany(reviewRows);
  if (reviewsError) return { score: null, reviews: [], error: reviewsError };

  const { data: existing } = await scoresRepo.findByAsset(assetType, assetId);
  const nextRegeneration =
    status === "regenerate" ? (existing?.regeneration_count ?? regenerationCount) + 1 : regenerationCount;

  const { data: score, error: scoreError } = await scoresRepo.upsertScore({
    asset_type: assetType,
    asset_id: assetId,
    final_score: finalScore,
    approved,
    regeneration_count: nextRegeneration,
  });

  if (scoreError) return { score: null, reviews: savedReviews ?? [], error: scoreError };

  recordSystemLog({
    tipo: approved ? "info" : status === "regenerate" ? "warning" : "error",
    modulo: "aura-excellence",
    mensagem: `Auditoria ${assetType} — score ${finalScore} (${status})`,
    detalhes: {
      assetType,
      assetId,
      finalScore,
      status,
      approved,
      regenerationCount: nextRegeneration,
      reviewers: reviews.map((review) => ({ reviewer: review.reviewer, score: review.score })),
    },
  });

  return { score, reviews: savedReviews ?? [], error: null };
}

async function reviewAssetInternal(
  assetType: ExcellenceAssetType,
  assetId: string,
  overrideContent?: string,
  overrideLabel?: string
): Promise<{ result: ExcellenceReviewResult | null; error: string | null }> {
  let content = overrideContent?.trim() ?? "";
  let label = overrideLabel?.trim() ?? "";

  if (!content) {
    const { bundle, error } = await loadAssetContent(assetType, assetId);
    if (error || !bundle) return { result: null, error: error ?? "Ativo não encontrado." };
    content = bundle.content;
    label = bundle.label;
  } else {
    label = label || buildExcellenceAssetLabel(assetType, assetId);
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) return { result: null, error: "Usuário não autenticado." };

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const { data: existing } = await scoresRepo.findByAsset(assetType, assetId);

  const specialistReviews = await runSpecialistReviews(assetType, content, label);
  const { score, error } = await persistReviewResult(
    assetType,
    assetId,
    specialistReviews,
    existing?.regeneration_count ?? 0
  );

  if (error || !score) return { result: null, error: error ?? "Erro ao salvar auditoria." };

  return {
    result: reviewsToResult(assetType, assetId, specialistReviews, score.regeneration_count),
    error: null,
  };
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
  const assetType = input.asset_type;
  const assetId = input.asset_id;

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { result: null, reviews: [], score: null, error: "Usuário não autenticado." };
  }

  if (!input.force_refresh) {
    const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);
    const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
    const [{ data: existingReviews }, { data: existingScore }] = await Promise.all([
      reviewsRepo.findByAsset(assetType, assetId),
      scoresRepo.findByAsset(assetType, assetId),
    ]);

    if (existingScore && existingReviews?.length) {
      return {
        result: reviewsToResult(
          assetType,
          assetId,
          existingReviews.map((review) => ({
            reviewer: review.reviewer,
            score: review.score,
            strengths: review.strengths,
            weaknesses: review.weaknesses,
            recommendations: review.recommendations,
          })),
          existingScore.regeneration_count
        ),
        reviews: existingReviews,
        score: existingScore,
        error: null,
      };
    }
  }

  const { result, error } = await reviewAssetInternal(
    assetType,
    assetId,
    input.content,
    input.label
  );

  if (error || !result) {
    return { result: null, reviews: [], score: null, error: error ?? "Erro na auditoria." };
  }

  const reviewsRepo = new QualityReviewsRepository(ctx.supabase, ctx.userId);
  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const [{ data: reviews }, { data: score }] = await Promise.all([
    reviewsRepo.findByAsset(assetType, assetId),
    scoresRepo.findByAsset(assetType, assetId),
  ]);

  return { result, reviews: reviews ?? [], score, error: null };
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
