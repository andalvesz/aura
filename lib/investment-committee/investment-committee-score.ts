import type { ProductBuildBrief } from "@/utils/product-build-brief";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import type { SalesPackage } from "@/utils/sales-system";

export const INVESTMENT_APPROVAL_THRESHOLD = 90;
export const SPECIALIST_MIN_APPROVAL = 80;

export const SPECIALIST_WEIGHTS = {
  CEO: 0.22,
  CMO: 0.22,
  "Copy Chief": 0.18,
  "Product Specialist": 0.2,
  "Performance Manager": 0.18,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function avg(...values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeInvestmentScore(
  scores: Record<keyof typeof SPECIALIST_WEIGHTS, number>
): number {
  const total =
    scores.CEO * SPECIALIST_WEIGHTS.CEO +
    scores.CMO * SPECIALIST_WEIGHTS.CMO +
    scores["Copy Chief"] * SPECIALIST_WEIGHTS["Copy Chief"] +
    scores["Product Specialist"] * SPECIALIST_WEIGHTS["Product Specialist"] +
    scores["Performance Manager"] * SPECIALIST_WEIGHTS["Performance Manager"];

  return roundScore(clamp(total));
}

export function isSpecialistApproved(score: number): boolean {
  return score >= SPECIALIST_MIN_APPROVAL;
}

export function isInvestmentApproved(
  investmentScore: number,
  specialistScores: number[]
): boolean {
  return (
    investmentScore >= INVESTMENT_APPROVAL_THRESHOLD &&
    specialistScores.every((score) => score >= SPECIALIST_MIN_APPROVAL)
  );
}

export function scoreCeo(input: {
  meta: MasterFlowMetadata;
  brief: ProductBuildBrief | null;
}): number {
  const { meta, brief } = input;
  const opportunity = meta.selected_opportunity;
  const opportunityScore =
    brief?.opportunity_score ??
    opportunity?.opportunityScore.total ??
    meta.opportunity_engine_score ??
    50;
  const validationScore = brief?.validation_score ?? meta.validation_score ?? 50;
  const profitSignal = opportunity?.estimatedProfit ?? 0;
  const profitScore =
    profitSignal >= 15000 ? 95 : profitSignal >= 8000 ? 85 : profitSignal >= 3000 ? 70 : 50;
  const margin = brief?.margin ?? opportunity?.opportunityScore.margin ?? 50;
  const positioning =
    (opportunity?.uniquenessScore ?? 50) * 0.5 +
    (brief?.strategist_score ?? meta.product_strategist_score ?? 50) * 0.5;

  return roundScore(
    clamp(avg(opportunityScore, validationScore, profitScore, margin, positioning))
  );
}

export function scoreCmo(input: {
  salesPackage: SalesPackage;
  meta: MasterFlowMetadata;
}): number {
  const { salesPackage, meta } = input;
  const offerScore = salesPackage.offer.score;
  const funnelScore = avg(salesPackage.landing.score, salesPackage.checkout.score);
  const differentiation =
    meta.selected_opportunity?.uniquenessScore ??
    meta.product_strategist_score ??
    60;
  const conversionSignal = avg(
    salesPackage.landing.score,
    salesPackage.copy.score,
    salesPackage.checkout.score
  );
  const componentAvg = avg(offerScore, funnelScore, differentiation, conversionSignal);
  const allReady =
    salesPackage.offer.ready &&
    salesPackage.landing.ready &&
    salesPackage.checkout.ready &&
    salesPackage.copy.ready;
  const readinessPenalty =
    !salesPackage.offer.ready || !salesPackage.landing.ready ? 15 : 0;

  const blended = allReady
    ? avg(componentAvg, salesPackage.commercialScore)
    : componentAvg - readinessPenalty;

  return roundScore(clamp(blended));
}

export function scoreCopyChief(input: { salesPackage: SalesPackage }): number {
  const { salesPackage } = input;
  const headlineSignal = salesPackage.landing.score;
  const promiseSignal = salesPackage.offer.score;
  const ctaSignal = salesPackage.checkout.score;
  const claritySignal = salesPackage.copy.score;
  const persuasionSignal = avg(salesPackage.copy.score, salesPackage.creativePackage.score);
  const componentAvg = avg(headlineSignal, promiseSignal, ctaSignal, claritySignal, persuasionSignal);
  const allReady =
    salesPackage.copy.ready &&
    salesPackage.landing.ready &&
    salesPackage.creativePackage.ready;
  const readinessPenalty =
    !salesPackage.copy.ready || !salesPackage.landing.ready ? 12 : 0;

  const blended = allReady
    ? avg(componentAvg, salesPackage.commercialScore)
    : componentAvg - readinessPenalty;

  return roundScore(clamp(blended));
}

export function scoreProductSpecialist(input: {
  salesPackage: SalesPackage;
  meta: MasterFlowMetadata;
  brief: ProductBuildBrief | null;
}): number {
  const { salesPackage, meta, brief } = input;
  const quality =
    meta.product_quality_score ?? salesPackage.product.score ?? 0;
  const adherence = meta.product_strategy_adherence?.score ?? quality;
  const transformation =
    brief?.strategist_score ?? meta.product_strategist_score ?? 60;
  const structure = salesPackage.product.score;
  const bonusSignal = meta.product_strategy_adherence?.aligned ? 90 : 65;
  const coherence = avg(quality, adherence, brief?.validation_score ?? meta.validation_score ?? 60);

  const readinessPenalty = !salesPackage.product.ready ? 20 : 0;

  return roundScore(
    clamp(avg(quality, adherence, transformation, structure, bonusSignal, coherence) - readinessPenalty)
  );
}

export function scorePerformanceManager(input: {
  salesPackage: SalesPackage;
  meta: MasterFlowMetadata;
  brief: ProductBuildBrief | null;
}): number {
  const { salesPackage, meta, brief } = input;
  const opportunity = meta.selected_opportunity;
  const scalability = opportunity?.opportunityScore.scalability ?? 60;
  const launchSpeed = opportunity?.opportunityScore.launchSpeed ?? brief?.estimated_launch_time
    ? Math.max(40, 100 - (brief?.estimated_launch_time ?? 14) * 2)
    : 60;
  const ticket = brief?.ticket ?? meta.ticket ?? opportunity?.price ?? 97;
  const estimatedCac = ticket >= 500 ? 35 : ticket >= 200 ? 45 : ticket >= 97 ? 55 : 70;
  const ctrSignal = avg(salesPackage.creativePackage.score, salesPackage.copy.score);
  const scaleSignal = avg(scalability, salesPackage.commercialScore, launchSpeed);
  const componentAvg = avg(100 - estimatedCac, ctrSignal, scaleSignal);
  const mediaReady =
    salesPackage.creativePackage.ready &&
    salesPackage.copy.ready &&
    salesPackage.checkout.ready;

  const blended =
    mediaReady && salesPackage.commercialScore >= 88
      ? avg(componentAvg, salesPackage.commercialScore, scalability)
      : componentAvg;

  return roundScore(clamp(blended));
}
