/**
 * Aura Intelligence Engine V1 — pure analysis, no I/O.
 *
 * Consumes DTOs → runs plugin rules → emits structured result.
 * Never returns free-form chat text. Never calls OpenAI or the database.
 */

import { buildAlerts } from "@/lib/intelligence/alerts";
import { buildInsights } from "@/lib/intelligence/insights";
import { buildPriorities } from "@/lib/intelligence/priorities";
import { buildRecommendations } from "@/lib/intelligence/recommendations";
import {
  evaluateRules,
  listRules,
  registerDefaultPlugins,
} from "@/lib/intelligence/rules";
import { computeScore } from "@/lib/intelligence/score";
import type {
  AuraIntelligenceInput,
  AuraIntelligenceResult,
  IntelligenceRule,
} from "@/lib/intelligence/types";

let pluginsReady = false;

export function ensureDefaultPlugins(): void {
  if (pluginsReady && listRules().length > 0) return;
  registerDefaultPlugins();
  pluginsReady = true;
}

/**
 * Run the intelligence engine on a fully formed DTO input.
 */
export function runAuraIntelligenceEngine(
  input: AuraIntelligenceInput,
  options?: { rules?: IntelligenceRule[]; skipDefaultPlugins?: boolean }
): AuraIntelligenceResult {
  const started = Date.now();

  if (!options?.skipDefaultPlugins) {
    ensureDefaultPlugins();
  }

  const ruleResults = evaluateRules(input, options?.rules);
  const priorities = buildPriorities(ruleResults);
  const alerts = buildAlerts(ruleResults);
  const recommendations = buildRecommendations(input, ruleResults);
  const insights = buildInsights(input);
  const score = computeScore(input, ruleResults);

  return {
    priorities,
    alerts,
    recommendations,
    insights,
    score,
    ruleResults,
    meta: {
      context: input.context,
      asOf: input.asOf,
      generatedAt: new Date().toISOString(),
      executionMs: Date.now() - started,
      rulesRun: ruleResults.length,
      cacheHit: false,
    },
  };
}
