/**
 * Memory → World Model projector.
 */

import {
  createWorldEntityPure,
  createWorldRelationshipPure,
  emptyProjectionReport,
  type WorldModelState,
} from "@/lib/world-model/engine";
import type { ProjectionReport } from "@/lib/world-model/types";
import type { MemoryRecord } from "@/lib/memory/types";

export function projectMemoryToWorldModelPure(
  state: WorldModelState,
  userId: string,
  memory: MemoryRecord,
  options?: { dryRun?: boolean; personEntityId?: string }
): { state: WorldModelState; report: ProjectionReport } {
  const report = emptyProjectionReport(Boolean(options?.dryRun));

  if (
    memory.status === "REJECTED" ||
    memory.status === "DISPUTED" ||
    memory.status === "DELETED" ||
    memory.promotionStatus === "BLOCKED" ||
    memory.deletedAt
  ) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: `Memória ${memory.status}/${memory.promotionStatus} não projeta`,
    });
    return { state, report };
  }

  if (memory.sourceType === "search_or_browse") {
    report.suppressed++;
    report.items.push({
      kind: "entity",
      action: "suppressed",
      id: null,
      reason: "Pesquisa isolada não projeta interesse/objetivo",
    });
    return { state, report };
  }

  if (memory.memoryType === "REFLECTIVE" && memory.status !== "CONFIRMED") {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: "Reflexiva não confirmada não vira fato",
    });
    return { state, report };
  }

  if (options?.dryRun) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: `Projetaria memória ${memory.id}`,
    });
    return { state, report };
  }

  let next = state;
  const entityType =
    memory.memoryType === "PROCEDURAL"
      ? "procedure"
      : memory.memoryType === "EPISODIC"
        ? "event"
        : memory.memoryType === "SEMANTIC"
          ? "concept"
          : "memory";

  const ent = createWorldEntityPure(next, userId, {
    entityType,
    displayName: memory.title,
    description: memory.content.slice(0, 280),
    sourceType: "memory_engine",
    sourceReference: { entityType: "memory", entityId: memory.id },
    context: memory.context,
    workspaceId: memory.workspaceId,
    confidence: Math.min(memory.confidence, 70),
    confirmNow: memory.status === "CONFIRMED",
    attributes:
      memory.memoryType === "PROCEDURAL" &&
      memory.structuredContent.kind === "procedural"
        ? {
            version: memory.structuredContent.version,
            validationStatus: memory.structuredContent.validationStatus,
          }
        : memory.memoryType === "EPISODIC" &&
            memory.structuredContent.kind === "episodic"
          ? { occurredAt: memory.structuredContent.when }
          : {},
    metadata: { memoryType: memory.memoryType },
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
  const wasUpdate = state.entities.some((e) => e.id === ent.data!.id);
  if (wasUpdate) {
    report.updated++;
    report.items.push({
      kind: "entity",
      action: "updated",
      id: ent.data.id,
      reason: "idempotente",
    });
  } else {
    report.created++;
    report.items.push({
      kind: "entity",
      action: "created",
      id: ent.data.id,
      reason: "projeção memória",
    });
  }

  // EVIDENCED_BY from person if available
  if (options?.personEntityId) {
    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: ent.data.id,
      targetEntityId: options.personEntityId,
      relationshipType: "EVIDENCED_BY",
      // wait — EVIDENCED_BY is source evidenced by target memory-like
      // Better: person — EVIDENCED_BY is wrong direction
      // Use: entity DERIVED_FROM memory entity, or memory REPRESENTS
      sourceType: "memory_engine",
      sourceReference: { entityType: "memory", entityId: memory.id },
      confirmNow: memory.status === "CONFIRMED",
      evidenceSummary: `Memória ${memory.id}`,
    });
    // Fix: use REPRESENTS from memory entity toward concept is already the entity itself
    // Link person PARTICIPATES_IN event for episodic
    void rel;
  }

  if (options?.personEntityId && memory.memoryType === "EPISODIC") {
    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: options.personEntityId,
      targetEntityId: ent.data.id,
      relationshipType: "PARTICIPATES_IN",
      sourceType: "memory_engine",
      sourceReference: { entityType: "memory", entityId: memory.id },
      confirmNow: memory.status === "CONFIRMED",
      evidenceSummary: "Participação em evento (memória episódica)",
    });
    if (rel.ok && rel.data) {
      next = rel.state;
      report.created++;
      report.items.push({
        kind: "relationship",
        action: "created",
        id: rel.data.id,
        reason: "PARTICIPATES_IN",
      });
    }
  }

  return { state: next, report };
}
