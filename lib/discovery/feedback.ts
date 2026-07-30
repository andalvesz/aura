/**
 * Discovery feedback + suppression helpers.
 */

import type {
  DiscoveryArtifact,
  DiscoveryFeedback,
  DiscoveryFeedbackKind,
  DiscoveryStatus,
  DiscoverySuppression,
  DiscoveryType,
} from "@/lib/discovery/types";
import { DEFAULT_SUPPRESSION_DAYS } from "@/lib/discovery/types";

export function createDiscoveryFeedback(input: {
  userId: string;
  workspaceId?: string | null;
  discoveryId: string;
  kind: DiscoveryFeedbackKind;
  note?: string | null;
  visibilityScope?: import("@/lib/aura-brain/visibility").VisibilityScope;
}): DiscoveryFeedback {
  return {
    id: `dfb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    discoveryId: input.discoveryId,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    visibilityScope: input.visibilityScope ?? "PRIVATE",
    createdAt: new Date().toISOString(),
  };
}

export const createFeedback = createDiscoveryFeedback;

export function statusAfterDiscoveryFeedback(
  kind: DiscoveryFeedbackKind,
  current: DiscoveryStatus
): DiscoveryStatus {
  switch (kind) {
    case "confirm":
    case "useful":
      return "CONFIRMED";
    case "reject":
    case "not_useful":
      return "REJECTED";
    case "archive":
      return "ARCHIVED";
    case "suppress_similar":
      return "SUPPRESSED";
    case "outdated":
      return "OUTDATED";
    case "needs_more_evidence":
      return "PENDING_CONFIRMATION";
    default:
      return current;
  }
}

export const statusAfterFeedback = statusAfterDiscoveryFeedback;

export function createDiscoverySuppression(input: {
  userId: string;
  workspaceId?: string | null;
  discovery: DiscoveryArtifact;
  reason: string;
  expiresAt?: string | null;
  days?: number;
  visibilityScope?: import("@/lib/aura-brain/visibility").VisibilityScope;
}): DiscoverySuppression {
  const days = input.days ?? DEFAULT_SUPPRESSION_DAYS;
  const expires =
    input.expiresAt ??
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `dsp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    discoveryType: input.discovery.type as DiscoveryType,
    semanticKey: input.discovery.suppressionKey,
    reason: input.reason,
    expiresAt: expires,
    createdAt: new Date().toISOString(),
    brokenAt: null,
    breakReason: null,
    visibilityScope:
      input.visibilityScope ??
      input.discovery.visibilityScope ??
      "PRIVATE",
  };
}

export function createSuppression(input: {
  userId: string;
  workspaceId?: string | null;
  artifact: DiscoveryArtifact;
  reason: string;
  expiresAt?: string | null;
}): DiscoverySuppression {
  return createDiscoverySuppression({
    userId: input.userId,
    workspaceId: input.workspaceId,
    discovery: input.artifact,
    reason: input.reason,
    expiresAt: input.expiresAt,
  });
}

export function isDiscoverySuppressionActive(
  s: DiscoverySuppression,
  now = Date.now()
): boolean {
  if (s.brokenAt) return false;
  if (s.expiresAt && new Date(s.expiresAt).getTime() < now) return false;
  return true;
}

export const isSuppressionActive = isDiscoverySuppressionActive;

export function matchesSuppression(
  artifact: Pick<DiscoveryArtifact, "type" | "suppressionKey">,
  s: DiscoverySuppression
): boolean {
  if (!isDiscoverySuppressionActive(s)) return false;
  if (s.discoveryType !== "*" && s.discoveryType !== artifact.type) return false;
  return s.semanticKey === artifact.suppressionKey;
}

export function recalculateConfidenceAfterFeedback(
  current: number,
  kind: DiscoveryFeedbackKind
): number {
  switch (kind) {
    case "confirm":
    case "useful":
      return Math.min(100, current + 12);
    case "reject":
    case "not_useful":
    case "suppress_similar":
      return Math.max(0, current - 25);
    case "needs_more_evidence":
      return Math.max(0, current - 10);
    case "outdated":
      return Math.max(0, current - 15);
    default:
      return current;
  }
}
