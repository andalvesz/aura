/**
 * Identity → World Model projector (CONFIRMED / LEARNED only).
 */

import {
  createWorldEntityPure,
  createWorldRelationshipPure,
  emptyProjectionReport,
  type WorldModelState,
} from "@/lib/world-model/engine";
import type { ProjectionReport } from "@/lib/world-model/types";
import type { IdentityClaim } from "@/lib/identity/types";

export function projectIdentityToWorldModelPure(
  state: WorldModelState,
  userId: string,
  claim: IdentityClaim,
  options?: { dryRun?: boolean; personEntityId?: string }
): { state: WorldModelState; report: ProjectionReport } {
  const report = emptyProjectionReport(Boolean(options?.dryRun));

  if (claim.status !== "CONFIRMED" && claim.status !== "LEARNED") {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: `Claim ${claim.status} não projeta (V1: só CONFIRMED/LEARNED)`,
    });
    return { state, report };
  }

  if (claim.sensitivity === "RESTRICTED") {
    report.suppressed++;
    report.items.push({
      kind: "entity",
      action: "suppressed",
      id: null,
      reason: "Claim RESTRICTED bloqueada",
    });
    return { state, report };
  }

  if (options?.dryRun) {
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: `Projetaria claim ${claim.key}`,
    });
    report.skipped++;
    return { state, report };
  }

  let next = state;

  // Ensure person self
  let personId = options?.personEntityId;
  if (!personId) {
    const person = createWorldEntityPure(next, userId, {
      entityType: "person",
      displayName: "Eu",
      description: "Self do usuário",
      sourceType: "identity_engine",
      sourceReference: { entityType: "user", entityId: userId },
      confirmNow: true,
      context: "personal",
      canonicalKey: `src:identity_engine:user:${userId}`,
    });
    if (person.ok && person.data) {
      next = person.state;
      personId = person.data.id;
    }
  }

  const targetType =
    claim.category === "skill"
      ? "skill"
      : claim.category === "goal"
        ? "goal"
        : claim.key.includes("language") || claim.category === "learning_style"
          ? "language"
          : "concept";

  const target = createWorldEntityPure(next, userId, {
    entityType: targetType,
    displayName: claim.label,
    description: claim.description || String(claim.value),
    sourceType: "identity_engine",
    sourceReference: { entityType: "identity_claim", entityId: claim.id },
    context: claim.contextScope,
    workspaceId: claim.workspaceId,
    confirmNow: true,
    confidence: claim.confidence,
    attributes:
      targetType === "language"
        ? { code: String(claim.value) }
        : targetType === "concept"
          ? { key: claim.key }
          : {},
  });
  if (!target.ok || !target.data) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: target.error ?? "falha",
    });
    return { state: next, report };
  }
  next = target.state;
  report.created++;
  report.items.push({
    kind: "entity",
    action: "created",
    id: target.data.id,
    reason: "claim confirmada",
  });

  if (personId) {
    const relType =
      claim.category === "skill"
        ? "HAS_SKILL"
        : claim.category === "goal"
          ? "HAS_GOAL"
          : claim.category === "preference" || claim.category === "communication"
            ? "PREFERS"
            : targetType === "language"
              ? "LEARNING"
              : "PREFERS";

    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: personId,
      targetEntityId: target.data.id,
      relationshipType: relType,
      sourceType: "identity_engine",
      sourceReference: { entityType: "identity_claim", entityId: claim.id },
      confirmNow: true,
      confidence: claim.confidence,
      evidenceSummary: `Claim ${claim.key}`,
      context: claim.contextScope,
    });
    if (rel.ok && rel.data) {
      next = rel.state;
      report.created++;
      report.items.push({
        kind: "relationship",
        action: "created",
        id: rel.data.id,
        reason: relType,
      });
    }
  }

  return { state: next, report };
}
