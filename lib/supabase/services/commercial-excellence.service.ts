import type { ExcellenceAssetType } from "@/types/database";
import { QualityScoresRepository } from "@/lib/supabase/repositories/aura-excellence.repository";
import {
  COMMERCIAL_EXCELLENCE_MAX_CYCLES,
  computeCommercialExcellenceResult,
  computeCommercialExcellenceScore,
  isCommercialExcellenceDeliverable,
  type CommercialAssetScore,
  type CommercialExcellenceResult,
} from "@/utils/commercial-excellence";
import { getOptionalDataContext } from "./context";

export async function loadCommercialAssetScores(
  targets: Array<{ assetType: string; assetId: string }>
): Promise<CommercialAssetScore[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const scoresRepo = new QualityScoresRepository(ctx.supabase, ctx.userId);
  const results: CommercialAssetScore[] = [];

  for (const target of targets) {
    const { data: score } = await scoresRepo.findByAsset(
      target.assetType as ExcellenceAssetType,
      target.assetId
    );
    results.push({
      assetType: target.assetType,
      assetId: target.assetId,
      excellenceScore: score?.excellence_score ?? null,
      finalScore: score?.final_score ?? null,
      qualityScore: score?.excellence_score ?? score?.final_score ?? null,
    });
  }

  return results;
}

export async function computeCommercialExcellenceForFlow(params: {
  copylabId?: string | null;
  funnelId?: string | null;
  campaignId?: string | null;
  factoryId?: string | null;
  productId?: string | null;
  landingId?: string | null;
  creativeAssetId?: string | null;
  offerId?: string | null;
}): Promise<CommercialExcellenceResult> {
  const targets: Array<{ assetType: string; assetId: string }> = [];
  if (params.factoryId) targets.push({ assetType: "ebook", assetId: params.factoryId });
  else if (params.productId) targets.push({ assetType: "ebook", assetId: params.productId });
  if (params.offerId) targets.push({ assetType: "offer", assetId: params.offerId });
  if (params.copylabId) targets.push({ assetType: "copy", assetId: params.copylabId });
  if (params.landingId) targets.push({ assetType: "landing", assetId: params.landingId });
  if (params.creativeAssetId) targets.push({ assetType: "creative", assetId: params.creativeAssetId });
  if (params.funnelId) targets.push({ assetType: "funnel", assetId: params.funnelId });
  if (params.campaignId) targets.push({ assetType: "campaign", assetId: params.campaignId });

  const assets = await loadCommercialAssetScores(targets);
  return computeCommercialExcellenceResult(assets);
}

async function improveCommercialTargets(
  targets: Array<{
    assetType: "copy" | "funnel" | "campaign" | "ebook" | "landing" | "creative" | "offer";
    assetId: string;
  }>,
  label?: string,
  cycle = 0
): Promise<void> {
  const { improveAsset } = await import("./excellence-auto-improve.service");
  const { isAutoImproveAssetType } = await import("@/utils/excellence-auto-improve");

  for (const target of targets) {
    console.info("[stack-debug] commercial-excellence improve target", {
      assetType: target.assetType,
      asset_id: target.assetId,
      label,
    });

    if (target.assetType === "ebook") {
      console.info("[product-pro-trace] COMMERCIAL_EXCELLENCE", {
        targetId: target.assetId,
        cycle,
      });

      const { isProductProLocked } = await import("@/utils/product-pro-locks");
      if (isProductProLocked(target.assetId)) {
        console.info("[product-pro] skip commercial-excellence improve due to active lock", {
          assetId: target.assetId,
        });
        continue;
      }

      const { runProductFactoryProAction } = await import("./product-factory.service");
      console.info("[product-pro-trace] CALLER", {
        source: "commercial-excellence.service/improveCommercialTargets",
        targetId: target.assetId,
        cycle,
      });
      await runProductFactoryProAction(target.assetId, "improve", {
        source: "commercial_excellence",
        skipExcellenceTrigger: true,
      });
      continue;
    }

    if (isAutoImproveAssetType(target.assetType)) {
      await improveAsset({
        assetType: target.assetType,
        assetId: target.assetId,
        label,
        module: "commercial-excellence",
      });
    } else {
      const { runExcellencePipeline } = await import("./excellence-integration.service");
      await runExcellencePipeline({
        assetType: target.assetType,
        assetId: target.assetId,
        label,
        module: "commercial-excellence",
      });
    }
  }
}

export async function runCommercialExcellence(params: {
  copylabId?: string | null;
  funnelId?: string | null;
  campaignId?: string | null;
  factoryId?: string | null;
  productId?: string | null;
  landingId?: string | null;
  creativeAssetId?: string | null;
  offerId?: string | null;
  label?: string;
}): Promise<{
  score: number;
  commercial_excellence_score: number;
  deliverable: boolean;
  cycles: number;
  error: string | null;
}> {
  const targets: Array<{
    assetType: "copy" | "funnel" | "campaign" | "ebook" | "landing" | "creative" | "offer";
    assetId: string;
  }> = [];
  if (params.factoryId) targets.push({ assetType: "ebook", assetId: params.factoryId });
  else if (params.productId) targets.push({ assetType: "ebook", assetId: params.productId });
  if (params.offerId) targets.push({ assetType: "offer", assetId: params.offerId });
  if (params.copylabId) targets.push({ assetType: "copy", assetId: params.copylabId });
  if (params.landingId) targets.push({ assetType: "landing", assetId: params.landingId });
  if (params.creativeAssetId) targets.push({ assetType: "creative", assetId: params.creativeAssetId });
  if (params.funnelId) targets.push({ assetType: "funnel", assetId: params.funnelId });
  if (params.campaignId) targets.push({ assetType: "campaign", assetId: params.campaignId });

  let cycles = 0;
  let summary = await computeCommercialExcellenceForFlow(params);

  while (!summary.deliverable && cycles < COMMERCIAL_EXCELLENCE_MAX_CYCLES) {
    cycles += 1;
    console.info("[stack-debug] commercial-excellence cycle", {
      cycle: cycles,
      maxCycles: COMMERCIAL_EXCELLENCE_MAX_CYCLES,
      deliverable: summary.deliverable,
      score: summary.commercial_excellence_score,
      factoryId: params.factoryId ?? null,
    });
    await improveCommercialTargets(targets, params.label, cycles);
    summary = await computeCommercialExcellenceForFlow(params);
  }

  const score = summary.commercial_excellence_score || computeCommercialExcellenceScore(summary.assets);

  return {
    score,
    commercial_excellence_score: score,
    deliverable: isCommercialExcellenceDeliverable(score),
    cycles,
    error:
      isCommercialExcellenceDeliverable(score)
        ? null
        : `commercial_excellence_score ${score} abaixo do mínimo após ${cycles} ciclos.`,
  };
}
