import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import { CreatorCopylabRepository } from "@/lib/supabase/repositories/copylab.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { ImprovementCyclesRepository } from "@/lib/supabase/repositories/improvement-cycles.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { QualityScoresRepository } from "@/lib/supabase/repositories/aura-excellence.repository";
import type { AutoImproveAssetType, ImprovementCycle, Json, TableUpdate } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  AUTO_IMPROVE_MAX_CYCLES,
  isAutoImproveAssetType,
  resolveAutoImproveAction,
  resolveCycleStatus,
  shouldAutoImprove,
  type AutoImproveResult,
} from "@/utils/excellence-auto-improve";
import type { SpecialistConsultResult, SpecialistReviewDetail } from "@/utils/specialist-engine";
import { loadAssetContent } from "./excellence-asset.loader";
import { reviewWithSpecialists } from "./specialist-engine.service";
import { getOptionalDataContext } from "./context";

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

function collectImprovementHints(reviews: SpecialistReviewDetail[]): {
  weaknesses: string[];
  recommendations: string[];
} {
  const weaknesses = reviews.flatMap((r) => r.weaknesses).filter(Boolean).slice(0, 12);
  const recommendations = reviews.flatMap((r) => r.recommendations).filter(Boolean).slice(0, 12);
  return { weaknesses, recommendations };
}

async function callImproveAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.55,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

async function applyAssetImprovement(
  assetType: AutoImproveAssetType,
  assetId: string,
  content: string,
  reviews: SpecialistReviewDetail[]
): Promise<{ applied: string[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { applied: [], error: "Usuário não autenticado." };
  if (!getOpenAi()) return { applied: [], error: "IA indisponível (OPENAI_API_KEY)." };

  const hints = collectImprovementHints(reviews);
  const basePrompt = [
    `Melhore o ativo (${assetType}) com base nas fraquezas e recomendações dos especialistas.`,
    "",
    "Conteúdo atual:",
    content.slice(0, 5000),
    "",
    "Fraquezas:",
    hints.weaknesses.map((w) => `- ${w}`).join("\n") || "—",
    "",
    "Recomendações:",
    hints.recommendations.map((r) => `- ${r}`).join("\n") || "—",
    "",
    "Regras: mantenha ética, não invente provas falsas, eleve clareza e conversão.",
  ].join("\n");

  switch (assetType) {
    case "copy": {
      const improved = await callImproveAi<Record<string, unknown>>(
        `${COPYLAB_AI_CONTEXT}\nRetorne JSON com campos melhorados: headline, subheadline, bullets (array), cta, pagina_vendas, storytelling, facebook_ad.`,
        basePrompt
      );
      if (!improved?.headline) {
        return { applied: [], error: "Não foi possível melhorar a copy." };
      }

      const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
      const patch: TableUpdate<"creator_copylab"> = {};
      const fields = [
        "headline",
        "subheadline",
        "bullets",
        "cta",
        "pagina_vendas",
        "storytelling",
        "facebook_ad",
        "big_idea",
        "mecanismo_unico",
        "garantia",
        "bonus",
      ] as const;

      const applied: string[] = [];
      for (const field of fields) {
        if (improved[field] != null) {
          (patch as Record<string, unknown>)[field] = improved[field];
          applied.push(field);
        }
      }

      const { error } = await repo.update(assetId, patch);
      return { applied, error: error ?? null };
    }

    case "landing": {
      const improved = await callImproveAi<Record<string, unknown>>(
        `${COPYLAB_AI_CONTEXT}\nRetorne JSON: title, headline, subheadline, hero_copy, cta_text, benefits (array de {title, description}).`,
        basePrompt
      );
      if (!improved?.headline) {
        return { applied: [], error: "Não foi possível melhorar a landing." };
      }

      const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
      const patch: TableUpdate<"landing_pages"> = {};
      const applied: string[] = [];

      for (const field of ["title", "headline", "subheadline", "hero_copy", "cta_text"] as const) {
        if (improved[field] != null) {
          (patch as Record<string, unknown>)[field] = improved[field];
          applied.push(field);
        }
      }
      if (Array.isArray(improved.benefits)) {
        patch.benefits_json = improved.benefits as Json;
        applied.push("benefits_json");
      }

      const { error } = await repo.update(assetId, patch);
      return { applied, error: error ?? null };
    }

    case "creative": {
      const improved = await callImproveAi<Record<string, unknown>>(
        `${COPYLAB_AI_CONTEXT}\nRetorne JSON: title, copy, prompt, hook.`,
        basePrompt
      );
      if (!improved?.copy && !improved?.title) {
        return { applied: [], error: "Não foi possível melhorar o criativo." };
      }

      const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
      const patch: TableUpdate<"creative_assets"> = {};
      const applied: string[] = [];

      for (const field of ["title", "copy", "prompt"] as const) {
        if (improved[field] != null) {
          (patch as Record<string, unknown>)[field] = improved[field];
          applied.push(field);
        }
      }

      const { error } = await repo.update(assetId, patch);
      return { applied, error: error ?? null };
    }

    case "offer": {
      const improved = await callImproveAi<Record<string, unknown>>(
        `${COPYLAB_AI_CONTEXT}\nRetorne JSON: title, description, price (number), rationale.`,
        basePrompt
      );
      if (!improved?.title && !improved?.description) {
        return { applied: [], error: "Não foi possível melhorar a oferta." };
      }

      const repo = new OffersRepository(ctx.supabase, ctx.userId);
      const patch: TableUpdate<"offers"> = {};
      const applied: string[] = [];

      if (improved.title != null) {
        patch.title = String(improved.title);
        applied.push("title");
      }
      if (improved.description != null) {
        patch.description = String(improved.description);
        applied.push("description");
      }
      if (typeof improved.price === "number") {
        patch.price = improved.price;
        applied.push("price");
      }

      const { error } = await repo.update(assetId, patch);
      return { applied, error: error ?? null };
    }

    case "funnel": {
      const improved = await callImproveAi<Record<string, unknown>>(
        `${COPYLAB_AI_CONTEXT}\nRetorne JSON: funnel_name, niche, strategy_notes, expected_conversion (number 0-1).`,
        basePrompt
      );
      if (!improved?.funnel_name && !improved?.niche) {
        return { applied: [], error: "Não foi possível melhorar o funil." };
      }

      const repo = new FunnelsRepository(ctx.supabase, ctx.userId);
      const { data: existing } = await repo.findById(assetId);
      const metadata =
        existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};

      const patch: TableUpdate<"funnels"> = {
        metadata: {
          ...metadata,
          auto_improve: {
            strategy_notes: improved.strategy_notes ?? null,
            improved_at: new Date().toISOString(),
          },
        } as Json,
      };
      const applied: string[] = ["metadata"];

      if (improved.funnel_name != null) {
        patch.funnel_name = String(improved.funnel_name);
        applied.push("funnel_name");
      }
      if (improved.niche != null) {
        patch.niche = String(improved.niche);
        applied.push("niche");
      }
      if (typeof improved.expected_conversion === "number") {
        patch.expected_conversion = improved.expected_conversion;
        applied.push("expected_conversion");
      }

      const { error } = await repo.update(assetId, patch);
      return { applied, error: error ?? null };
    }

    default:
      return { applied: [], error: "Tipo de ativo não suportado para auto improve." };
  }
}

async function recordCycle(
  repo: ImprovementCyclesRepository,
  params: {
    assetType: AutoImproveAssetType;
    assetId: string;
    cycleNumber: number;
    action: ImprovementCycle["action"];
    scoreBefore: number | null;
    scoreAfter: number | null;
    status: ImprovementCycle["status"];
    improvementsApplied?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<ImprovementCycle | null> {
  const { data } = await repo.recordCycle({
    asset_type: params.assetType,
    asset_id: params.assetId,
    cycle_number: params.cycleNumber,
    action: params.action,
    score_before: params.scoreBefore,
    score_after: params.scoreAfter,
    status: params.status,
    improvements_applied: params.improvementsApplied ?? [],
    metadata: (params.metadata ?? {}) as Json,
  });
  return data;
}

export async function improveAsset(input: {
  assetType: AutoImproveAssetType;
  assetId: string;
  label?: string;
  module?: string;
  maxCycles?: number;
}): Promise<{
  result: AutoImproveResult | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { result: null, error: "Usuário não autenticado." };

  if (!isAutoImproveAssetType(input.assetType)) {
    return { result: null, error: "Tipo de ativo não suportado para auto improve." };
  }

  const maxCycles = Math.min(input.maxCycles ?? AUTO_IMPROVE_MAX_CYCLES, AUTO_IMPROVE_MAX_CYCLES);
  const cyclesRepo = new ImprovementCyclesRepository(ctx.supabase, ctx.userId);
  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const recordedCycles: ImprovementCycle[] = [];
  const sourceModule = input.module ?? "excellence-auto-improve";

  let lastResult: SpecialistConsultResult | null = null;
  let previousScore: number | null = null;

  recordSystemLog({
    tipo: "info",
    modulo: "excellence",
    mensagem: "Auto improve iniciado",
    detalhes: {
      assetType: input.assetType,
      assetId: input.assetId,
      maxCycles,
      module: sourceModule,
    },
  });

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    const { result, reviews, score, error } = await reviewWithSpecialists({
      asset_type: input.assetType,
      asset_id: input.assetId,
      label: input.label,
      force_refresh: true,
    });

    if (error || !result) {
      return { result: null, error: error ?? "Erro na auditoria." };
    }

    lastResult = result;
    const action = resolveAutoImproveAction(result.finalScore);

    const reviewCycle = await recordCycle(cyclesRepo, {
      assetType: input.assetType,
      assetId: input.assetId,
      cycleNumber: cycle,
      action: "review",
      scoreBefore: previousScore,
      scoreAfter: result.finalScore,
      status: resolveCycleStatus(action, result.finalScore),
      metadata: { module: sourceModule, specialist_status: result.status },
    });
    if (reviewCycle) recordedCycles.push(reviewCycle);

    if (action === "approve") {
      await recordCycle(cyclesRepo, {
        assetType: input.assetType,
        assetId: input.assetId,
        cycleNumber: cycle,
        action: "approve",
        scoreBefore: previousScore,
        scoreAfter: result.finalScore,
        status: "approved",
        metadata: { module: sourceModule },
      });

      recordSystemLog({
        tipo: "info",
        modulo: "excellence",
        mensagem: "Ativo aprovado pelo auto improve",
        detalhes: { assetType: input.assetType, assetId: input.assetId, finalScore: result.finalScore },
      });

      return {
        result: {
          assetType: input.assetType,
          assetId: input.assetId,
          finalScore: result.finalScore,
          status: result.status,
          outcome: "approved",
          deliverable: true,
          cycles: recordedCycles,
          cyclesUsed: cycle,
        },
        error: null,
      };
    }

    if (action === "block") {
      await recordCycle(cyclesRepo, {
        assetType: input.assetType,
        assetId: input.assetId,
        cycleNumber: cycle,
        action: "block",
        scoreBefore: previousScore,
        scoreAfter: result.finalScore,
        status: "blocked",
        metadata: { module: sourceModule },
      });

      await scoresRepo.upsertScore({
        asset_type: input.assetType,
        asset_id: input.assetId,
        final_score: result.finalScore,
        excellence_score: result.excellenceScore,
        benchmark_score: result.benchmarkScore,
        approved: false,
        regeneration_count: score?.regeneration_count ?? cycle,
      });

      recordSystemLog({
        tipo: "error",
        modulo: "excellence",
        mensagem: "Ativo bloqueado pelo auto improve",
        detalhes: { assetType: input.assetType, assetId: input.assetId, finalScore: result.finalScore },
      });

      return {
        result: {
          assetType: input.assetType,
          assetId: input.assetId,
          finalScore: result.finalScore,
          status: result.status,
          outcome: "blocked",
          deliverable: false,
          cycles: recordedCycles,
          cyclesUsed: cycle,
        },
        error: null,
      };
    }

    if (!shouldAutoImprove(result.finalScore)) {
      break;
    }

    if (cycle >= maxCycles) {
      await recordCycle(cyclesRepo, {
        assetType: input.assetType,
        assetId: input.assetId,
        cycleNumber: cycle,
        action: "improve",
        scoreBefore: previousScore,
        scoreAfter: result.finalScore,
        status: "max_cycles",
        metadata: { module: sourceModule, reason: "max_cycles_reached" },
      });

      return {
        result: {
          assetType: input.assetType,
          assetId: input.assetId,
          finalScore: result.finalScore,
          status: result.status,
          outcome: "max_cycles",
          deliverable: false,
          cycles: recordedCycles,
          cyclesUsed: cycle,
        },
        error: null,
      };
    }

    const { bundle, error: loadError } = await loadAssetContent(input.assetType, input.assetId);
    if (loadError || !bundle) {
      return { result: null, error: loadError ?? "Conteúdo do ativo não encontrado." };
    }

    const { applied, error: improveError } = await applyAssetImprovement(
      input.assetType,
      input.assetId,
      bundle.content,
      result.reviews
    );

    if (improveError) {
      return { result: null, error: improveError };
    }

    const improveCycle = await recordCycle(cyclesRepo, {
      assetType: input.assetType,
      assetId: input.assetId,
      cycleNumber: cycle,
      action: "improve",
      scoreBefore: result.finalScore,
      scoreAfter: null,
      status: "improved",
      improvementsApplied: applied,
      metadata: { module: sourceModule },
    });
    if (improveCycle) recordedCycles.push(improveCycle);

    previousScore = result.finalScore;
    void reviews;
  }

  if (!lastResult) {
    return { result: null, error: "Nenhuma auditoria executada." };
  }

  return {
    result: {
      assetType: input.assetType,
      assetId: input.assetId,
      finalScore: lastResult.finalScore,
      status: lastResult.status,
      outcome: "max_cycles",
      deliverable: lastResult.approved,
      cycles: recordedCycles,
      cyclesUsed: maxCycles,
    },
    error: null,
  };
}

export type { AutoImproveResult };
