export type RevenueTruthClass = "real" | "estimated" | "synthetic";

export type RevenueTruthInput = {
  source: string;
  metricType?: string | null;
  hasWebhook?: boolean;
  hasPlatformConnection?: boolean;
};

export function classifyRevenueTruth(input: RevenueTruthInput): RevenueTruthClass {
  if (input.metricType === "real" || input.hasWebhook) return "real";
  if (
    input.source === "stripe_webhook" ||
    input.source === "kiwify_webhook" ||
    input.source === "hotmart_webhook"
  ) {
    return "real";
  }
  if (input.source === "checkout_engine" && input.hasPlatformConnection) return "estimated";
  if (input.source === "offer_engine" || input.source === "ads_commander") return "estimated";
  return "synthetic";
}

export function resolveRevenueCountry(params: {
  intentCountry?: string | null;
  productCountry?: string | null;
  fallback?: string;
}): string {
  const code = params.intentCountry?.trim() || params.productCountry?.trim() || params.fallback || "BR";
  return code.toUpperCase().length === 2 ? code.toUpperCase() : code;
}

export function isTruthLoopClosed(truth: RevenueTruthClass): boolean {
  return truth === "real";
}
