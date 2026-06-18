import { recordSystemLog } from "@/lib/logs/record";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import type { Json } from "@/types/database";
import {
  classifyRevenueTruth,
  computeTruthConfidenceScore,
  resolveRevenueCountry,
  type RevenueTruthClass,
} from "@/utils/revenue-truth-engine";
import { shouldOverwriteRevenueTruth } from "@/utils/revenue-truth-priority";
import { getOptionalDataContext } from "./context";
import type { RevenueRegisterInput } from "@/utils/revenue-ai";

export type TruthRevenueInput = RevenueRegisterInput & {
  intentCountry?: string | null;
  hasWebhook?: boolean;
  hasPlatformConnection?: boolean;
};

export async function registerTruthRevenue(
  input: TruthRevenueInput
): Promise<{
  metric: Awaited<ReturnType<typeof import("./revenue-ai.service").registerRevenue>>["metric"];
  truth: RevenueTruthClass;
  truth_confidence_score: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { metric: null, truth: "synthetic", truth_confidence_score: 0, error: "Usuário não autenticado." };
  }

  let productCountry: string | null = null;
  if (input.productId) {
    const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
    const { data: product } = await productsRepo.findById(input.productId);
    productCountry = product?.target_country ?? null;
  }

  const source =
    (typeof input.metadata === "object" &&
    input.metadata &&
    !Array.isArray(input.metadata) &&
    typeof (input.metadata as Record<string, unknown>).source === "string"
      ? String((input.metadata as Record<string, unknown>).source)
      : null) ?? String(input.platform ?? "revenue_ai");

  const truth = classifyRevenueTruth({
    source,
    metricType: input.metricType,
    hasWebhook: input.hasWebhook,
    hasPlatformConnection: input.hasPlatformConnection,
  });

  const truth_confidence_score = computeTruthConfidenceScore({
    truth,
    source,
    hasWebhook: input.hasWebhook,
    hasPlatformConnection: input.hasPlatformConnection,
  });

  const country = resolveRevenueCountry({
    intentCountry: input.intentCountry ?? input.country,
    productCountry,
    fallback: input.country ?? "BR",
  });

  const { registerRevenue } = await import("./revenue-ai.service");
  const { metric, error } = await registerRevenue({
    ...input,
    country,
    metricType: truth === "real" ? "real" : input.metricType ?? "estimated",
    metadata: {
      ...(typeof input.metadata === "object" && input.metadata && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {}),
      revenue_truth: truth,
      truth_confidence_score,
      country_resolved: country,
      truth_priority_applied: shouldOverwriteRevenueTruth(
        "estimated",
        truth,
        "revenue_ai",
        source
      ),
    } as Json,
  });

  if (metric) {
    recordSystemLog({
      tipo: "info",
      modulo: "revenue-truth-engine",
      mensagem: `Receita registrada (${truth}) — ${input.platform ?? "geral"}`,
      detalhes: { truth, truth_confidence_score, country, revenue: metric.revenue, productId: input.productId },
    });
  }

  return { metric, truth, truth_confidence_score, error };
}
