/**
 * Business / workspace → World Model projector.
 */

import {
  createWorldEntityPure,
  createWorldRelationshipPure,
  emptyProjectionReport,
  type WorldModelState,
} from "@/lib/world-model/engine";
import type { ProjectionReport } from "@/lib/world-model/types";

export type BusinessProjectionInput = {
  id: string;
  name: string;
  kind?: "business" | "organization" | "workspace";
  sector?: string;
  workspaceId?: string | null;
  /** Only when explicit domain field / claim / user confirmation */
  founderConfirmed?: boolean;
};

export function projectBusinessToWorldModelPure(
  state: WorldModelState,
  userId: string,
  input: BusinessProjectionInput,
  options?: { dryRun?: boolean; personEntityId?: string }
): { state: WorldModelState; report: ProjectionReport } {
  const report = emptyProjectionReport(Boolean(options?.dryRun));
  const entityType = input.kind ?? "business";

  if (options?.dryRun) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: `Projetaria ${entityType} ${input.id}`,
    });
    return { state, report };
  }

  let next = state;
  const ent = createWorldEntityPure(next, userId, {
    entityType,
    displayName: input.name,
    description: "",
    sourceType: entityType === "workspace" ? "workspace" : "business",
    sourceReference: {
      entityType: entityType,
      entityId: input.id,
    },
    workspaceId: input.workspaceId ?? null,
    confirmNow: true,
    confidence: 80,
    attributes: input.sector ? { sector: input.sector } : {},
    context: "business",
  });

  if (!ent.ok || !ent.data) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: ent.error ?? "falha",
    });
    return { state: next, report };
  }
  next = ent.state;
  report.created++;
  report.items.push({
    kind: "entity",
    action: "created",
    id: ent.data.id,
    reason: "cadastro estruturado",
  });

  if (options?.personEntityId) {
    if (entityType === "workspace") {
      const rel = createWorldRelationshipPure(next, userId, {
        sourceEntityId: options.personEntityId,
        targetEntityId: ent.data.id,
        relationshipType: "MEMBER_OF",
        sourceType: "workspace",
        sourceReference: { entityType: "workspace", entityId: input.id },
        confirmNow: true,
      });
      if (rel.ok && rel.data) {
        next = rel.state;
        report.created++;
        report.items.push({
          kind: "relationship",
          action: "created",
          id: rel.data.id,
          reason: "MEMBER_OF",
        });
      }
    } else if (input.founderConfirmed) {
      const rel = createWorldRelationshipPure(next, userId, {
        sourceEntityId: options.personEntityId,
        targetEntityId: ent.data.id,
        relationshipType: "FOUNDER_OF",
        sourceType: "user_explicit",
        sourceReference: { entityType: entityType, entityId: input.id },
        confirmNow: true,
        evidenceSummary: "Fundador confirmado explicitamente",
      });
      if (rel.ok && rel.data) {
        next = rel.state;
        report.created++;
        report.items.push({
          kind: "relationship",
          action: "created",
          id: rel.data.id,
          reason: "FOUNDER_OF",
        });
      }
    }
  }

  return { state: next, report };
}
