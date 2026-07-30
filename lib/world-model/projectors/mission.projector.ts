/**
 * Mission Engine → World Model projector.
 */

import {
  createWorldEntityPure,
  createWorldRelationshipPure,
  emptyProjectionReport,
  type WorldModelState,
} from "@/lib/world-model/engine";
import type { ProjectionReport } from "@/lib/world-model/types";
import type { Mission } from "@/lib/missions/mission-types";

export function projectMissionToWorldModelPure(
  state: WorldModelState,
  userId: string,
  mission: Mission,
  options?: {
    dryRun?: boolean;
    personEntityId?: string;
    workspaceEntityId?: string | null;
  }
): { state: WorldModelState; report: ProjectionReport } {
  const report = emptyProjectionReport(Boolean(options?.dryRun));

  if (mission.status === "ARCHIVED") {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "skipped",
      id: null,
      reason: "Missão arquivada",
    });
    return { state, report };
  }

  if (options?.dryRun) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: `Projetaria missão ${mission.id}`,
    });
    return { state, report };
  }

  let next = state;
  const ent = createWorldEntityPure(next, userId, {
    entityType: "mission",
    displayName: mission.title,
    description: mission.description?.slice(0, 280) ?? "",
    sourceType: "mission_engine",
    sourceReference: { entityType: "mission", entityId: mission.id },
    context: "missions",
    workspaceId: mission.workspaceId ?? null,
    confirmNow: true,
    confidence: 85,
    attributes: {
      missionStatus: mission.status,
      missionType: mission.type,
      progress: mission.progress?.totalPct ?? 0,
    },
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
    reason: "missão explícita",
  });

  if (options?.personEntityId) {
    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: options.personEntityId,
      targetEntityId: ent.data.id,
      relationshipType: "HAS_MISSION",
      sourceType: "mission_engine",
      sourceReference: { entityType: "mission", entityId: mission.id },
      confirmNow: true,
      evidenceSummary: "Missão criada pelo usuário",
    });
    if (rel.ok && rel.data) {
      next = rel.state;
      report.created++;
      report.items.push({
        kind: "relationship",
        action: "created",
        id: rel.data.id,
        reason: "HAS_MISSION",
      });
    }
  }

  if (options?.workspaceEntityId) {
    const rel = createWorldRelationshipPure(next, userId, {
      sourceEntityId: options.workspaceEntityId,
      targetEntityId: ent.data.id,
      relationshipType: "HAS_MISSION",
      sourceType: "mission_engine",
      sourceReference: { entityType: "mission", entityId: mission.id },
      confirmNow: true,
      workspaceId: mission.workspaceId ?? null,
      evidenceSummary: "Missão no workspace",
    });
    if (rel.ok && rel.data) {
      next = rel.state;
      report.created++;
      report.items.push({
        kind: "relationship",
        action: "created",
        id: rel.data.id,
        reason: "workspace HAS_MISSION",
      });
    }
  }

  return { state: next, report };
}
