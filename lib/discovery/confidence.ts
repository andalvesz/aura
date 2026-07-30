/**
 * Discovery confidence helpers — ADR-005 / ADR-006
 */

import type { ConfidenceBand } from "@/lib/discovery/types";

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function clampConfidence(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calibrateDiscoveryConfidence(input: {
  base: number;
  evidenceCount: number;
  layers: number;
  rejectedBefore?: boolean;
}): number {
  let score = input.base;
  if (input.evidenceCount < 2) score = Math.min(score, 55);
  if (input.layers < 2) score = Math.min(score, 65);
  if (input.rejectedBefore) score = Math.min(score, 35);
  return clampConfidence(score);
}

/** Alias */
export const calculateDiscoveryConfidence = (
  input: Parameters<typeof calibrateDiscoveryConfidence>[0]
) => calibrateDiscoveryConfidence(input);
