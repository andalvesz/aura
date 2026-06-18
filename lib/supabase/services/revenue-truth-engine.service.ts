import { recordSystemLog } from "@/lib/logs/record";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import type { Json } from "@/types/database";
import {
  classifyRevenueTruth,
  resolveRevenueCountry,
  type RevenueTruthClass,
} from "@/utils/revenue-truth-engine";
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
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { metric: null, truth: "synthetic", error: "Usuário não autenticado." };

  let productCountry: string | null = null;
  if (input.productId) {
    const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
    const { data: product } = await productsRepo.findById(input.productId);
    productCountry = product?.target_country ?? null;
  }

  const truth = classifyRevenueTruth({
    source:
      (typeof input.metadata === "object" &&
      input.metadata &&
      !Array.isArray(input.metadata) &&
      typeof (input.metadata as Record<string, unknown>).source === "string"
        ? String((input.metadata as Record<string, unknown>).source)
        : null) ??
      String(input.platform ?? "revenue_ai"),
    metricType: input.metricType,
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
      country_resolved: country,
    } as Json,
  });

  if (metric) {
    recordSystemLog({
      tipo: "info",
      modulo: "revenue-truth-engine",
      mensagem: `Receita registrada (${truth}) — ${input.platform ?? "geral"}`,
      detalhes: { truth, country, revenue: metric.revenue, productId: input.productId },
    });
  }

  return { metric, truth, error };
}
