/**
 * Evidence Resolver — normalized, reference-based evidence.
 */

import { createHash } from "node:crypto";
import type {
  CognitiveContext,
  CognitiveEvidence,
  EvidenceSourceLayer,
  SourceReference,
} from "@/lib/cognitive/types";

export function evidenceId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export function independenceKey(
  layer: EvidenceSourceLayer,
  sourceId: string,
  aspect?: string
): string {
  return `${layer}:${sourceId}${aspect ? `:${aspect}` : ""}`;
}

export function hashEvidenceSet(evidence: CognitiveEvidence[]): string {
  const keys = evidence
    .map((e) => e.independenceKey)
    .sort()
    .join(",");
  return createHash("sha256").update(keys).digest("hex").slice(0, 32);
}

export function makeEvidence(input: {
  evidenceType: string;
  sourceLayer: EvidenceSourceLayer;
  sourceType: string;
  sourceId: string;
  sourceReference?: SourceReference | null;
  observedAt?: string;
  context?: string;
  confidence: number;
  authority?: number;
  summary: string;
  supports?: "supports" | "counter" | "neutral";
  relationshipToClaim?: string;
  relevance?: number;
}): CognitiveEvidence {
  const independence = independenceKey(input.sourceLayer, input.sourceId);
  return {
    id: evidenceId([
      input.sourceLayer,
      input.sourceId,
      input.evidenceType,
      input.summary,
    ]),
    evidenceType: input.evidenceType,
    sourceLayer: input.sourceLayer,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceReference: input.sourceReference ?? {
      entityType: input.sourceLayer,
      entityId: input.sourceId,
    },
    observedAt: input.observedAt ?? new Date().toISOString(),
    context: input.context ?? "general",
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
    authority: input.authority ?? 50,
    independenceKey: independence,
    summary: input.summary.slice(0, 280),
    sensitivity: "STANDARD",
    relevance: input.relevance ?? 70,
    supports: input.supports ?? "supports",
    relationshipToClaim: input.relationshipToClaim ?? "supports_observation",
  };
}

export function buildEvidenceIndex(context: CognitiveContext): CognitiveEvidence[] {
  const out: CognitiveEvidence[] = [];

  for (const c of context.identityContext.claims) {
    if (["REJECTED", "DELETED", "ARCHIVED"].includes(c.status)) continue;
    out.push(
      makeEvidence({
        evidenceType: "identity_claim",
        sourceLayer: "identity",
        sourceType: "identity_engine",
        sourceId: c.id,
        confidence: c.confidence,
        authority: c.status === "CONFIRMED" ? 90 : 55,
        summary: `${c.category}.${c.key}=${c.value}`,
        context: c.contextScope,
      })
    );
  }

  for (const m of context.memoryContext.memories) {
    if (["REJECTED", "DELETED", "ARCHIVED", "DISPUTED"].includes(m.status)) {
      continue;
    }
    out.push(
      makeEvidence({
        evidenceType: "memory",
        sourceLayer: "memory",
        sourceType: "memory_engine",
        sourceId: m.id,
        confidence: m.confidence,
        authority: 60,
        summary: m.title || m.summary,
      })
    );
  }

  for (const e of context.worldContext.entities) {
    if (["REJECTED", "DELETED", "ARCHIVED"].includes(e.status)) continue;
    out.push(
      makeEvidence({
        evidenceType: "world_entity",
        sourceLayer: "world_model",
        sourceType: "world_model",
        sourceId: e.id,
        confidence: e.confidence,
        authority: 65,
        summary: `${e.entityType}:${e.displayName}`,
      })
    );
  }

  for (const r of context.worldContext.relationships) {
    if (["REJECTED", "DELETED", "ARCHIVED"].includes(r.status)) continue;
    out.push(
      makeEvidence({
        evidenceType: "world_relationship",
        sourceLayer: "world_model",
        sourceType: "world_model",
        sourceId: r.id,
        confidence: r.confidence,
        authority: 60,
        summary: `${r.relationshipType} (${r.context})`,
        context: r.context,
      })
    );
  }

  for (const m of context.missionContext.missions) {
    out.push(
      makeEvidence({
        evidenceType: "mission",
        sourceLayer: "mission",
        sourceType: "mission_engine",
        sourceId: m.id,
        confidence: 70,
        authority: 75,
        summary: `mission:${m.title} status=${m.status}`,
      })
    );
  }

  return out;
}

export function resolveEvidenceByIds(
  index: CognitiveEvidence[],
  ids: string[]
): CognitiveEvidence[] {
  const set = new Set(ids);
  return index.filter((e) => set.has(e.id) || set.has(e.sourceId));
}
