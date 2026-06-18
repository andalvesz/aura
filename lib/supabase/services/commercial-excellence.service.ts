import type { ExcellenceAssetType } from "@/types/database";
import { QualityScoresRepository } from "@/lib/supabase/repositories/aura-excellence.repository";
import {
  computeCommercialExcellenceScore,
  isCommercialExcellenceDeliverable,
  type CommercialAssetScore,
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
    });
  }

  return results;
}

export async function computeCommercialExcellenceForFlow(params: {
  copylabId?: string | null;
  funnelId?: string | null;
  campaignId?: string | null;
  factoryId?: string | null;
}): Promise<{
  score: number;
  deliverable: boolean;
  assets: CommercialAssetScore[];
}> {
  const targets: Array<{ assetType: string; assetId: string }> = [];
  if (params.copylabId) targets.push({ assetType: "copy", assetId: params.copylabId });
  if (params.funnelId) targets.push({ assetType: "funnel", assetId: params.funnelId });
  if (params.campaignId) targets.push({ assetType: "campaign", assetId: params.campaignId });
  if (params.factoryId) targets.push({ assetType: "ebook", assetId: params.factoryId });

  const assets = await loadCommercialAssetScores(targets);
  const score = computeCommercialExcellenceScore(assets);
  return { score, deliverable: isCommercialExcellenceDeliverable(score), assets };
}

export async function runCommercialExcellence(params: {
  copylabId?: string | null;
  funnelId?: string | null;
  campaignId?: string | null;
  factoryId?: string | null;
  label?: string;
}): Promise<{
  score: number;
  deliverable: boolean;
  error: string | null;
}> {
  const { improveAsset } = await import("./excellence-auto-improve.service");
  const { isAutoImproveAssetType } = await import("@/utils/excellence-auto-improve");

  const targets: Array<{ assetType: "copy" | "funnel" | "campaign" | "ebook"; assetId: string }> = [];
  if (params.copylabId) targets.push({ assetType: "copy", assetId: params.copylabId });
  if (params.funnelId) targets.push({ assetType: "funnel", assetId: params.funnelId });
  if (params.campaignId) targets.push({ assetType: "campaign", assetId: params.campaignId });
  if (params.factoryId) targets.push({ assetType: "ebook", assetId: params.factoryId });

  for (const target of targets) {
    if (isAutoImproveAssetType(target.assetType)) {
      await improveAsset({
        assetType: target.assetType,
        assetId: target.assetId,
        label: params.label,
        module: "commercial-excellence",
      });
    } else {
      const { runExcellencePipeline } = await import("./excellence-integration.service");
      await runExcellencePipeline({
        assetType: target.assetType,
        assetId: target.assetId,
        label: params.label,
        module: "commercial-excellence",
      });
    }
  }

  const summary = await computeCommercialExcellenceForFlow(params);
  return { score: summary.score, deliverable: summary.deliverable, error: null };
}
