/**
 * Aura Intelligence service — sole public entry for the rest of the app.
 *
 * Loads DTOs from existing services (never inside the pure engine),
 * runs the rules engine, and caches per user.
 */

import { runAuraIntelligenceEngine } from "@/lib/intelligence/engine";
import {
  getCachedIntelligence,
  setCachedIntelligence,
} from "@/lib/intelligence/cache";
import { invalidateAuraIntelligenceCache } from "@/lib/intelligence/invalidate";
import {
  buildPersonalIntelligenceInput,
  buildWorkspaceIntelligenceInput,
  mapMyDayToPersonalDTO,
  mapWorkspaceToDTO,
} from "@/lib/intelligence/map";
import type {
  AuraIntelligenceInput,
  AuraIntelligenceResult,
} from "@/lib/intelligence/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { getMyDaySummary } from "@/lib/supabase/services/my-day.service";
import { getWorkspaceDashboardSummary } from "@/lib/supabase/services/workspace-dashboard.service";
import { todayIsoDate } from "@/utils/health";

export type GetAuraIntelligenceOptions = {
  /** Prebuilt input — skips service aggregation (tests / callers with DTOs). */
  input?: AuraIntelligenceInput;
  skipCache?: boolean;
  /** Force personal aggregation even if active context is workspace. */
  forcePersonal?: boolean;
};

/**
 * Public API: analyze user data and return structured intelligence.
 * Never returns chatbot text. Never calls OpenAI.
 */
export async function getAuraIntelligence(
  options?: GetAuraIntelligenceOptions
): Promise<AuraIntelligenceResult> {
  if (options?.input) {
    const result = runAuraIntelligenceEngine(options.input);
    if (!options.skipCache) {
      setCachedIntelligence(
        options.input.userId,
        options.input.context,
        result
      );
    }
    return result;
  }

  const ctx = await getDataContext();
  const context: "personal" | "workspace" =
    options?.forcePersonal || ctx.activeContext !== "workspace"
      ? "personal"
      : "workspace";

  if (!options?.skipCache) {
    const cached = getCachedIntelligence(ctx.userId, context);
    if (cached) return cached;
  }

  let input: AuraIntelligenceInput;

  if (context === "workspace") {
    const summary = await getWorkspaceDashboardSummary();
    input = buildWorkspaceIntelligenceInput({
      userId: ctx.userId,
      asOf: todayIsoDate(),
      workspace: mapWorkspaceToDTO(summary),
    });
  } else {
    const summary = await getMyDaySummary();
    input = buildPersonalIntelligenceInput({
      userId: ctx.userId,
      asOf: todayIsoDate(),
      personal: mapMyDayToPersonalDTO(summary),
    });
  }

  const result = runAuraIntelligenceEngine(input);
  setCachedIntelligence(ctx.userId, context, result);
  return result;
}

/**
 * Analyze a My Day summary already loaded (avoids double aggregation).
 */
export async function getAuraIntelligenceFromMyDay(
  userId: string,
  summary: Awaited<ReturnType<typeof getMyDaySummary>>,
  options?: {
    skipCache?: boolean;
    extras?: Parameters<typeof mapMyDayToPersonalDTO>[1];
  }
): Promise<AuraIntelligenceResult> {
  const input = buildPersonalIntelligenceInput({
    userId,
    asOf: todayIsoDate(),
    personal: mapMyDayToPersonalDTO(summary, options?.extras),
  });

  if (!options?.skipCache) {
    const cached = getCachedIntelligence(userId, "personal");
    if (cached) return cached;
  }

  const result = runAuraIntelligenceEngine(input);
  setCachedIntelligence(userId, "personal", result);
  return result;
}
