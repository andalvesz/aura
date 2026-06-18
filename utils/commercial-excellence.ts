import { READY_TO_SELL_EXCELLENCE_MIN } from "@/utils/revenue-certification";

export const COMMERCIAL_EXCELLENCE_MIN = READY_TO_SELL_EXCELLENCE_MIN;
export const COMMERCIAL_EXCELLENCE_MAX_CYCLES = 3;

export type CommercialDimension =
  | "produto"
  | "oferta"
  | "landing"
  | "criativo"
  | "funil"
  | "campanha";

export const COMMERCIAL_DIMENSIONS: CommercialDimension[] = [
  "produto",
  "oferta",
  "landing",
  "criativo",
  "funil",
  "campanha",
];

export type CommercialAssetScore = {
  assetType: string;
  assetId: string;
  dimension?: CommercialDimension;
  excellenceScore: number | null;
  finalScore: number | null;
  qualityScore?: number | null;
};

export type CommercialExcellenceResult = {
  commercial_excellence_score: number;
  dimensions: Partial<Record<CommercialDimension, number>>;
  deliverable: boolean;
  assets: CommercialAssetScore[];
};

export function computeCommercialExcellenceScore(scores: CommercialAssetScore[]): number {
  const values = scores
    .map((item) => item.qualityScore ?? item.excellenceScore ?? item.finalScore)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function computeCommercialExcellenceResult(
  scores: CommercialAssetScore[]
): CommercialExcellenceResult {
  const dimensions: Partial<Record<CommercialDimension, number>> = {};
  const byDimension = new Map<CommercialDimension, number[]>();

  for (const item of scores) {
    const dimension = item.dimension ?? assetTypeToDimension(item.assetType);
    if (!dimension) continue;
    const value = item.qualityScore ?? item.excellenceScore ?? item.finalScore;
    if (value == null) continue;
    const list = byDimension.get(dimension) ?? [];
    list.push(value);
    byDimension.set(dimension, list);
  }

  for (const [dimension, values] of byDimension) {
    dimensions[dimension] = Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 100
    ) / 100;
  }

  const commercial_excellence_score = computeCommercialExcellenceScore(scores);

  return {
    commercial_excellence_score,
    dimensions,
    deliverable: isCommercialExcellenceDeliverable(commercial_excellence_score),
    assets: scores,
  };
}

function assetTypeToDimension(assetType: string): CommercialDimension | null {
  const map: Record<string, CommercialDimension> = {
    ebook: "produto",
    product: "produto",
    copy: "oferta",
    offer: "oferta",
    landing: "landing",
    creative: "criativo",
    funnel: "funil",
    campaign: "campanha",
  };
  return map[assetType] ?? null;
}

export function isCommercialExcellenceDeliverable(score: number): boolean {
  return score >= COMMERCIAL_EXCELLENCE_MIN;
}

export function commercialExcellenceLabel(score: number): string {
  if (score >= 95) return "Premium comercial";
  if (score >= COMMERCIAL_EXCELLENCE_MIN) return "Pronto para venda";
  if (score >= 70) return "Quase pronto";
  return "Precisa melhorar";
}
