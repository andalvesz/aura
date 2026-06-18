import type { RevenueTruthClass } from "@/utils/revenue-truth-engine";

export type RevenueTruthSource =
  | "stripe"
  | "stripe_webhook"
  | "kiwify"
  | "kiwify_webhook"
  | "hotmart"
  | "hotmart_webhook"
  | "meta"
  | "google"
  | "checkout_engine"
  | "offer_engine"
  | "ads_commander"
  | "revenue_ai";

/** Prioridade de fontes de verdade: REAL sempre sobrescreve ESTIMATED. */
export const REVENUE_TRUTH_PRIORITY: RevenueTruthSource[] = [
  "stripe",
  "stripe_webhook",
  "kiwify",
  "kiwify_webhook",
  "hotmart",
  "hotmart_webhook",
  "meta",
  "google",
  "checkout_engine",
  "offer_engine",
  "ads_commander",
  "revenue_ai",
];

export type RevenueTruthRecord = {
  source: RevenueTruthSource | string;
  truth: RevenueTruthClass;
  revenue?: number;
  confidence?: number;
};

export function resolveTruthSourcePriority(source: string): number {
  const normalized = source.toLowerCase().replace(/-/g, "_");
  const index = REVENUE_TRUTH_PRIORITY.findIndex(
    (item) => normalized === item || normalized.includes(item)
  );
  return index >= 0 ? index : REVENUE_TRUTH_PRIORITY.length;
}

export function shouldOverwriteRevenueTruth(
  existing: RevenueTruthClass,
  incoming: RevenueTruthClass,
  existingSource: string,
  incomingSource: string
): boolean {
  if (incoming === "real" && existing !== "real") return true;
  if (existing === "real" && incoming !== "real") return false;
  if (incoming === "estimated" && existing === "synthetic") return true;
  if (existing === incoming) {
    return resolveTruthSourcePriority(incomingSource) < resolveTruthSourcePriority(existingSource);
  }
  return resolveTruthSourcePriority(incomingSource) < resolveTruthSourcePriority(existingSource);
}

export function computeTruthConfidenceScore(params: {
  truth: RevenueTruthClass;
  source: string;
  hasWebhook?: boolean;
  hasPlatformConnection?: boolean;
  dataPoints?: number;
}): number {
  let score = 0;
  if (params.truth === "real") score += 70;
  else if (params.truth === "estimated") score += 45;
  else score += 15;

  if (params.hasWebhook) score += 20;
  if (params.hasPlatformConnection) score += 8;

  const priority = resolveTruthSourcePriority(params.source);
  const priorityBonus = Math.max(0, 12 - Math.floor(priority / 2));
  score += priorityBonus;

  if (params.dataPoints != null && params.dataPoints > 0) {
    score += Math.min(10, params.dataPoints * 2);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function mergeRevenueTruthRecords(
  existing: RevenueTruthRecord | null,
  incoming: RevenueTruthRecord
): RevenueTruthRecord {
  if (!existing) return incoming;
  if (
    shouldOverwriteRevenueTruth(
      existing.truth,
      incoming.truth,
      existing.source,
      incoming.source
    )
  ) {
    return {
      ...incoming,
      confidence: computeTruthConfidenceScore({
        truth: incoming.truth,
        source: incoming.source,
        dataPoints: 1,
      }),
    };
  }
  return existing;
}
