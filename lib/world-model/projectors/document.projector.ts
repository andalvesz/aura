/**
 * Document → World Model projector (structured sources only).
 */

import {
  createWorldEntityPure,
  createWorldRelationshipPure,
  emptyProjectionReport,
  type WorldModelState,
} from "@/lib/world-model/engine";
import type { ProjectionReport } from "@/lib/world-model/types";

export type DocumentProjectionInput = {
  id: string;
  title: string;
  mime?: string;
  workspaceId?: string | null;
  relatedEntityId?: string | null;
};

export function projectDocumentToWorldModelPure(
  state: WorldModelState,
  userId: string,
  input: DocumentProjectionInput,
  options?: { dryRun?: boolean }
): { state: WorldModelState; report: ProjectionReport } {
  const report = emptyProjectionReport(Boolean(options?.dryRun));

  if (options?.dryRun) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: `Projetaria documento ${input.id}`,
    });
    return { state, report };
  }

  let next = state;
  const ent = createWorldEntityPure(next, userId, {
    entityType: "document",
    displayName: input.title,
    description: "",
    sourceType: "document",
    sourceReference: { entityType: "document", entityId: input.id },
    workspaceId: input.workspaceId ?? null,
    confirmNow: true,
    confidence: 75,
    attributes: input.mime ? { mime: input.mime, title: input.title } : { title: input.title },
    context: "documents",
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
    reason: "documento estruturado",
  });

  if (input.relatedEntityId) {
    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: ent.data.id,
      targetEntityId: input.relatedEntityId,
      relationshipType: "DOCUMENTS",
      sourceType: "document",
      sourceReference: { entityType: "document", entityId: input.id },
      confirmNow: true,
      evidenceSummary: "Documento vinculado",
    });
    if (rel.ok && rel.data) {
      next = rel.state;
      report.created++;
      report.items.push({
        kind: "relationship",
        action: "created",
        id: rel.data.id,
        reason: "DOCUMENTS",
      });
    }
  }

  return { state: next, report };
}
