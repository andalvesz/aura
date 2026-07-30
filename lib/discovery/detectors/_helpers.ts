/**
 * Shared helpers for Discovery detectors.
 */

import { createHash } from "node:crypto";
import {
  calibrateDiscoveryConfidence,
  confidenceBand,
} from "@/lib/discovery/confidence";
import { inferSensitivity, sanitizeDiscoveryText } from "@/lib/discovery/privacy";
import type {
  DetectorCandidate,
  DiscoveryEvidence,
  DiscoveryType,
  ImpactLevel,
  UrgencyLevel,
} from "@/lib/discovery/types";
import { METHOD_VERSION } from "@/lib/discovery/types";

export function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

export function makeEvidence(input: {
  evidenceType: string;
  sourceLayer: DiscoveryEvidence["sourceLayer"];
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence?: number;
}): DiscoveryEvidence {
  return {
    id: `dev_${hashKey([input.sourceId, input.summary]).slice(0, 12)}`,
    evidenceType: input.evidenceType,
    sourceLayer: input.sourceLayer,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceReference: {
      entityType: input.sourceType,
      entityId: input.sourceId,
    },
    observedAt: new Date().toISOString(),
    summary: sanitizeDiscoveryText(input.summary),
    confidence: input.confidence ?? 50,
    supports: "supports",
  };
}

export function buildCandidate(input: {
  userId: string;
  workspaceId: string | null;
  type: DiscoveryType;
  detectorId: string;
  title: string;
  summary: string;
  description?: string;
  explanation: string;
  evidence: DiscoveryEvidence[];
  relatedEntities?: DetectorCandidate["relatedEntities"];
  relatedArtifacts?: DetectorCandidate["relatedArtifacts"];
  relatedMemories?: DetectorCandidate["relatedMemories"];
  relatedInsights?: DetectorCandidate["relatedInsights"];
  limitations?: string[];
  alternativeInterpretations?: string[];
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  baseConfidence: number;
  suppressionParts: string[];
}): DetectorCandidate {
  const fingerprint = hashKey([
    input.type,
    input.detectorId,
    input.workspaceId ?? "personal",
    ...input.suppressionParts,
  ]);
  const suppressionKey = hashKey([
    input.type,
    input.workspaceId ?? "personal",
    ...input.suppressionParts.slice(0, 3),
  ]);
  const layers = new Set(input.evidence.map((e) => e.sourceLayer)).size;
  const confidence = calibrateDiscoveryConfidence({
    base: input.baseConfidence,
    evidenceCount: input.evidence.length,
    layers,
  });
  const text = `${input.title} ${input.summary}`;
  const evidenceSetHash = hashKey(
    input.evidence.map((e) => `${e.sourceType}:${e.sourceId}:${e.summary}`)
  );

  return {
    userId: input.userId,
    workspaceId: input.workspaceId,
    type: input.type,
    title: sanitizeDiscoveryText(input.title),
    summary: sanitizeDiscoveryText(input.summary),
    description: sanitizeDiscoveryText(
      input.description ?? input.summary
    ),
    confidence,
    confidenceBand: confidenceBand(confidence),
    impact: input.impact ?? "MEDIUM",
    urgency: input.urgency ?? "MEDIUM",
    reversibility: "HIGH",
    evidence: input.evidence,
    evidenceSetHash,
    relatedEntities: input.relatedEntities ?? [],
    relatedArtifacts: input.relatedArtifacts ?? [],
    relatedMemories: input.relatedMemories ?? [],
    relatedInsights: input.relatedInsights ?? [],
    limitations: input.limitations ?? [
      "Sinal de descoberta — não é decisão nem execução",
      "Baseado em evidências disponíveis no momento",
    ],
    alternativeInterpretations: input.alternativeInterpretations ?? [
      "Pode ser coincidência temporal sem relação causal",
      "Dados incompletos podem exagerar o sinal",
    ],
    explanation: sanitizeDiscoveryText(input.explanation),
    origin: `detector:${input.detectorId}`,
    detectorId: input.detectorId,
    method: "discovery_detector_v1",
    methodVersion: METHOD_VERSION,
    suppressionKey,
    fingerprint,
    executionInfluence: "none",
    sensitivity: inferSensitivity(text),
    validFrom: new Date().toISOString(),
    validUntil: null,
    metadata: {},
  };
}
