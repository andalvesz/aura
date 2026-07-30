/**
 * Adapter — consumes existing Intelligence Engine without duplicating it.
 */

import type {
  AuraIntelligenceInput,
  AuraIntelligenceResult,
} from "@/lib/intelligence/types";
import { runAuraIntelligenceEngine } from "@/lib/intelligence/engine";
import {
  getAuraIntelligence,
  getAuraIntelligenceFromMyDay,
} from "@/lib/intelligence/services/intelligence.service";
import type { MyDaySummary } from "@/lib/supabase/services/my-day.service";

export async function loadIntelligenceViaAdapter(options?: {
  input?: AuraIntelligenceInput;
  skipCache?: boolean;
  forcePersonal?: boolean;
}): Promise<AuraIntelligenceResult> {
  if (options?.input) {
    return runAuraIntelligenceEngine(options.input);
  }
  return getAuraIntelligence({
    skipCache: options?.skipCache,
    forcePersonal: options?.forcePersonal,
  });
}

export async function loadIntelligenceFromMyDay(
  userId: string,
  summary: MyDaySummary,
  extras?: Parameters<typeof getAuraIntelligenceFromMyDay>[2]
): Promise<AuraIntelligenceResult> {
  return getAuraIntelligenceFromMyDay(userId, summary, extras);
}

export function sliceIntelligenceForBrain(result: AuraIntelligenceResult): {
  priorities: AuraIntelligenceResult["priorities"];
  alerts: AuraIntelligenceResult["alerts"];
  recommendations: AuraIntelligenceResult["recommendations"];
  insights: AuraIntelligenceResult["insights"];
  score: AuraIntelligenceResult["score"];
  meta: { executionMs: number; cacheHit: boolean };
} {
  return {
    priorities: result.priorities,
    alerts: result.alerts,
    recommendations: result.recommendations,
    insights: result.insights,
    score: result.score,
    meta: {
      executionMs: result.meta.executionMs,
      cacheHit: result.meta.cacheHit,
    },
  };
}
