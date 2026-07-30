/**
 * Deterministic confidence calculator — versioned.
 * ADR-005 · ADR-008
 */

import {
  CONFIDENCE_METHOD_VERSION,
  MAX_INFERENCE_CONFIDENCE,
  type CognitiveEvidence,
  type ConfidenceBand,
} from "@/lib/cognitive/types";

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

export function confidenceMethodVersion(): string {
  return CONFIDENCE_METHOD_VERSION;
}

/** Deduplicate by independenceKey — duplicates never boost. */
export function uniqueIndependentEvidence(
  evidence: CognitiveEvidence[]
): CognitiveEvidence[] {
  const seen = new Set<string>();
  const out: CognitiveEvidence[] = [];
  for (const e of evidence) {
    const key = e.independenceKey || `${e.sourceLayer}:${e.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function calculateEvidenceConfidence(
  evidence: CognitiveEvidence[]
): number {
  const independent = uniqueIndependentEvidence(
    evidence.filter((e) => e.supports === "supports")
  );
  if (independent.length === 0) return 0;
  const avg =
    independent.reduce((s, e) => s + e.confidence * (e.authority / 100), 0) /
    independent.length;
  const diversityBonus = Math.min(15, (independent.length - 1) * 5);
  return clampScore(Math.min(MAX_INFERENCE_CONFIDENCE, avg + diversityBonus));
}

export function calculatePatternConfidence(input: {
  evidence: CognitiveEvidence[];
  sampleSize: number;
  minSample: number;
  consistency: number;
  hasContradiction: boolean;
  counterEvidenceCount: number;
}): number {
  let base = calculateEvidenceConfidence(input.evidence);
  if (input.sampleSize < input.minSample) {
    base = Math.min(base, 25);
  } else {
    base = clampScore(base * (0.6 + 0.4 * Math.min(1, input.consistency)));
  }
  if (input.hasContradiction) base = Math.min(base, base - 20);
  if (input.counterEvidenceCount > 0) {
    base = clampScore(base - input.counterEvidenceCount * 8);
  }
  return clampScore(Math.min(MAX_INFERENCE_CONFIDENCE, base));
}

export function calculateHypothesisConfidence(input: {
  supporting: CognitiveEvidence[];
  counter: CognitiveEvidence[];
  assumptionCount: number;
  alternativeCount: number;
}): number {
  let base = calculateEvidenceConfidence(input.supporting);
  const counterPenalty =
    uniqueIndependentEvidence(input.counter).length * 10;
  base = clampScore(base - counterPenalty);
  if (input.assumptionCount > 2) base = clampScore(base - 5);
  if (input.alternativeCount === 0 && base >= 40) {
    // Prefer having alternatives for medium+ claims
    base = clampScore(base - 3);
  }
  return clampScore(Math.min(MAX_INFERENCE_CONFIDENCE, Math.max(10, base)));
}

export function calculateInsightConfidence(input: {
  patternConfidence: number;
  evidence: CognitiveEvidence[];
  hasCausalLanguage: boolean;
  sampleSmall: boolean;
  humanConfirmed?: boolean;
  humanRejected?: boolean;
}): number {
  if (input.humanRejected) return 0;
  let base = clampScore(
    (input.patternConfidence + calculateEvidenceConfidence(input.evidence)) / 2
  );
  if (input.hasCausalLanguage) base = Math.min(base, 35);
  if (input.sampleSmall) base = Math.min(base, 30);
  if (input.humanConfirmed) base = clampScore(Math.max(base, 80));
  return clampScore(Math.min(MAX_INFERENCE_CONFIDENCE, base));
}

export function calculateRecommendationConfidence(input: {
  insightConfidence: number;
  hasCriticalConflict: boolean;
  preferenceConfirmed: boolean;
}): number {
  if (input.hasCriticalConflict) return clampScore(Math.min(25, input.insightConfidence));
  let base = clampScore(input.insightConfidence * 0.9);
  if (input.preferenceConfirmed) base = clampScore(base + 5);
  return clampScore(Math.min(MAX_INFERENCE_CONFIDENCE, base));
}

export function calibratedLanguage(band: ConfidenceBand): string {
  switch (band) {
    case "LOW":
      return "pode indicar";
    case "MEDIUM":
      return "os dados sugerem";
    case "HIGH":
      return "o padrão foi observado de forma consistente neste contexto";
  }
}
