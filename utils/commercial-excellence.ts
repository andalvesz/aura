import { READY_TO_SELL_EXCELLENCE_MIN } from "@/utils/revenue-certification";

export const COMMERCIAL_EXCELLENCE_MIN = READY_TO_SELL_EXCELLENCE_MIN;

export type CommercialAssetScore = {
  assetType: string;
  assetId: string;
  excellenceScore: number | null;
  finalScore: number | null;
};

export function computeCommercialExcellenceScore(scores: CommercialAssetScore[]): number {
  const values = scores
    .map((item) => item.excellenceScore ?? item.finalScore)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
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
