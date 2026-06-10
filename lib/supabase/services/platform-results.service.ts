import type { Json, PlatformResultPlatform, PlatformResultType } from "@/types/database";
import { getOptionalDataContext } from "./context";

export async function recordPlatformResult(params: {
  platform: PlatformResultPlatform;
  resultType: PlatformResultType;
  title: string;
  summary?: string;
  valueCents?: number | null;
  currency?: string;
  metrics?: Record<string, unknown>;
  sourceId?: string | null;
  sourceTable?: string | null;
  routedTo?: string[];
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const { error } = await ctx.supabase.from("platform_results").insert({
    user_id: ctx.userId,
    platform: params.platform,
    result_type: params.resultType,
    title: params.title,
    summary: params.summary ?? null,
    value_cents: params.valueCents ?? null,
    currency: params.currency ?? "BRL",
    metrics: (params.metrics ?? {}) as Json,
    source_id: params.sourceId ?? null,
    source_table: params.sourceTable ?? null,
    routed_to: (params.routedTo ?? ["performance", "money", "ceo"]) as Json,
  });

  return { error: error?.message ?? null };
}
