/**
 * Confidence / importance / weight for Memory — ADR-005.
 * Kept separate from Identity claim confidence and promotion confidence.
 */

import type {
  ConfidenceBand,
  MemorySourceType,
  ScoreHistoryEntry,
} from "@/lib/memory/types";
import { ISOLATED_INTERACTION_SOURCES } from "@/lib/memory/types";

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function confidenceBand(score: number): ConfidenceBand {
  const c = clampScore(score);
  if (c >= 70) return "HIGH";
  if (c >= 40) return "MEDIUM";
  return "LOW";
}

export function sourceTrustBaseline(source: MemorySourceType): number {
  switch (source) {
    case "user_explicit":
    case "manual_entry":
    case "user_feedback":
      return 90;
    case "bootstrap_confirmed":
    case "identity_engine":
      return 85;
    case "imported_data":
      return 55;
    case "mission_engine":
    case "execution_result":
      return 50;
    case "calendar":
    case "finance":
    case "health":
    case "business":
      return 45;
    case "planner":
      return 35;
    case "system_observation":
      return 30;
    case "conversation":
    case "discovery_engine":
    case "search_or_browse":
      return 20;
    default:
      return 25;
  }
}

export function isIsolatedInteractionSource(source: MemorySourceType): boolean {
  return (ISOLATED_INTERACTION_SOURCES as string[]).includes(source);
}

export function initialMemoryConfidence(input: {
  sourceType: MemorySourceType;
  confirmNow?: boolean;
  explicitConfidence?: number;
  evidenceCount?: number;
}): number {
  if (input.confirmNow) return clampScore(input.explicitConfidence ?? 95);
  let c =
    typeof input.explicitConfidence === "number"
      ? clampScore(input.explicitConfidence)
      : sourceTrustBaseline(input.sourceType);

  if (isIsolatedInteractionSource(input.sourceType)) {
    c = Math.min(c, 35);
  }
  // Cap isolated observations even with multiple weak signals
  if ((input.evidenceCount ?? 1) <= 1 && isIsolatedInteractionSource(input.sourceType)) {
    c = Math.min(c, 30);
  }
  return clampScore(c);
}

export function initialImportance(input: {
  memoryType: string;
  sourceType: MemorySourceType;
  explicit?: number;
}): number {
  if (typeof input.explicit === "number") return clampScore(input.explicit);
  if (input.sourceType === "user_explicit" || input.sourceType === "manual_entry") {
    return 70;
  }
  if (input.memoryType === "REFLECTIVE") return 45;
  if (input.memoryType === "PROCEDURAL") return 50;
  if (isIsolatedInteractionSource(input.sourceType)) return 15;
  return 40;
}

export function initialWeight(input: {
  confidence: number;
  importance: number;
  statusBoost?: number;
}): number {
  const base = Math.round(input.confidence * 0.55 + input.importance * 0.45);
  return clampScore(base + (input.statusBoost ?? 0));
}

export function pushScoreHistory(
  history: ScoreHistoryEntry[],
  field: ScoreHistoryEntry["field"],
  from: number,
  to: number,
  reason: string,
  actor: "user" | "system",
  at = new Date().toISOString()
): ScoreHistoryEntry[] {
  return [
    {
      at,
      field,
      from: clampScore(from),
      to: clampScore(to),
      reason,
      actor,
    },
    ...history,
  ].slice(0, 40);
}

/** Independent evidence sources reinforce; identical events must not inflate. */
export function reinforceConfidence(
  current: number,
  evidenceStrength: number,
  independentSource: boolean
): number {
  if (!independentSource) return current;
  const bump = Math.min(12, Math.round(evidenceStrength * 0.1));
  return clampScore(current + bump);
}

export function applyContradictionPenalty(current: number): number {
  return clampScore(current - 25);
}
