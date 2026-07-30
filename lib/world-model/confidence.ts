/**
 * Confidence helpers for World Model — separate from Memory/Identity scores.
 */

import type { ConfidenceBand, WorldSourceType } from "@/lib/world-model/types";
import { ISOLATED_SOURCES } from "@/lib/world-model/types";
import { getRelationshipTypeDefinition } from "@/lib/world-model/relationship-registry";

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

export function sourceTrustBaseline(source: WorldSourceType): number {
  switch (source) {
    case "user_explicit":
    case "manual_entry":
      return 90;
    case "identity_engine":
    case "bootstrap":
      return 85;
    case "mission_engine":
    case "workspace":
    case "business":
    case "document":
      return 70;
    case "memory_engine":
      return 55;
    case "calendar":
    case "imported_data":
      return 45;
    case "system_observation":
    case "discovery_engine":
    case "search_or_browse":
      return 20;
    default:
      return 30;
  }
}

export function isIsolatedSource(source: WorldSourceType): boolean {
  return (ISOLATED_SOURCES as string[]).includes(source);
}

export function initialEntityConfidence(input: {
  sourceType: WorldSourceType;
  confirmNow?: boolean;
  explicit?: number;
}): number {
  if (input.confirmNow) return clampScore(input.explicit ?? 95);
  let c =
    typeof input.explicit === "number"
      ? clampScore(input.explicit)
      : sourceTrustBaseline(input.sourceType);
  if (isIsolatedSource(input.sourceType)) c = Math.min(c, 30);
  return clampScore(c);
}

export function initialRelationshipConfidence(input: {
  sourceType: WorldSourceType;
  relationshipType: string;
  confirmNow?: boolean;
  explicit?: number;
}): number {
  if (input.confirmNow) return clampScore(input.explicit ?? 95);
  const def = getRelationshipTypeDefinition(input.relationshipType);
  let c =
    typeof input.explicit === "number"
      ? clampScore(input.explicit)
      : sourceTrustBaseline(input.sourceType);

  if (def?.confidencePolicy === "inferred_low" || isIsolatedSource(input.sourceType)) {
    c = Math.min(c, 35);
  } else if (def?.confidencePolicy === "explicit_high" && input.sourceType !== "user_explicit") {
    c = Math.min(c, 60);
  }
  // Isolated observation never HIGH
  if (isIsolatedSource(input.sourceType)) c = Math.min(c, 30);
  return clampScore(c);
}

export function projectionConfidenceFrom(input: {
  sourceConfidence: number;
  entityOrRelConfidence: number;
}): number {
  return clampScore(
    Math.min(input.sourceConfidence, input.entityOrRelConfidence)
  );
}
