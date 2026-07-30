/**
 * Safe World Model bootstrap — idempotent, dry-run capable.
 */

import {
  createWorldEntityPure,
  type WorldModelState,
} from "@/lib/world-model/engine";
import { projectIdentityToWorldModelPure } from "@/lib/world-model/projectors/identity.projector";
import { projectMemoryToWorldModelPure } from "@/lib/world-model/projectors/memory.projector";
import { projectMissionToWorldModelPure } from "@/lib/world-model/projectors/mission.projector";
import { projectBusinessToWorldModelPure } from "@/lib/world-model/projectors/business.projector";
import { projectDocumentToWorldModelPure } from "@/lib/world-model/projectors/document.projector";
import type { ProjectionReport } from "@/lib/world-model/types";
import { emptyProjectionReport } from "@/lib/world-model/engine";
import type { IdentityClaim } from "@/lib/identity/types";
import type { MemoryRecord } from "@/lib/memory/types";
import type { Mission } from "@/lib/missions/mission-types";
import type { BusinessProjectionInput } from "@/lib/world-model/projectors/business.projector";
import type { DocumentProjectionInput } from "@/lib/world-model/projectors/document.projector";

export type WorldBootstrapInput = {
  userId: string;
  displayName?: string | null;
  claims?: IdentityClaim[];
  memories?: MemoryRecord[];
  missions?: Mission[];
  businesses?: BusinessProjectionInput[];
  documents?: DocumentProjectionInput[];
  dryRun?: boolean;
  maxItems?: number;
};

export type WorldBootstrapReport = ProjectionReport & {
  personEntityId: string | null;
};

function mergeReports(a: ProjectionReport, b: ProjectionReport): ProjectionReport {
  return {
    dryRun: a.dryRun || b.dryRun,
    items: [...a.items, ...b.items].slice(0, 200),
    created: a.created + b.created,
    updated: a.updated + b.updated,
    skipped: a.skipped + b.skipped,
    suppressed: a.suppressed + b.suppressed,
  };
}

export function applyBootstrapToWorldState(
  state: WorldModelState,
  input: WorldBootstrapInput
): { state: WorldModelState; report: WorldBootstrapReport } {
  const max = input.maxItems ?? 50;
  let next = state;
  let report: WorldBootstrapReport = {
    ...emptyProjectionReport(Boolean(input.dryRun)),
    personEntityId: null,
  };

  const person = createWorldEntityPure(next, input.userId, {
    entityType: "person",
    displayName: input.displayName?.trim() || "Eu",
    description: "Self do usuário",
    sourceType: "bootstrap",
    sourceReference: { entityType: "user", entityId: input.userId },
    confirmNow: true,
    context: "personal",
    canonicalKey: `src:bootstrap:user:${input.userId}`,
  });

  if (input.dryRun) {
    report.skipped++;
    report.items.push({
      kind: "entity",
      action: "dry_run",
      id: null,
      reason: "person self",
    });
  } else if (person.ok && person.data) {
    next = person.state;
    report.personEntityId = person.data.id;
    report.created++;
    report.items.push({
      kind: "entity",
      action: "created",
      id: person.data.id,
      reason: "self",
    });
  }

  let count = 1;
  for (const claim of input.claims ?? []) {
    if (count >= max) break;
    const r = projectIdentityToWorldModelPure(next, input.userId, claim, {
      dryRun: input.dryRun,
      personEntityId: report.personEntityId ?? undefined,
    });
    next = r.state;
    report = { ...mergeReports(report, r.report), personEntityId: report.personEntityId };
    count++;
  }

  for (const mem of input.memories ?? []) {
    if (count >= max) break;
    const r = projectMemoryToWorldModelPure(next, input.userId, mem, {
      dryRun: input.dryRun,
      personEntityId: report.personEntityId ?? undefined,
    });
    next = r.state;
    report = { ...mergeReports(report, r.report), personEntityId: report.personEntityId };
    count++;
  }

  for (const mission of input.missions ?? []) {
    if (count >= max) break;
    const r = projectMissionToWorldModelPure(next, input.userId, mission, {
      dryRun: input.dryRun,
      personEntityId: report.personEntityId ?? undefined,
    });
    next = r.state;
    report = { ...mergeReports(report, r.report), personEntityId: report.personEntityId };
    count++;
  }

  for (const biz of input.businesses ?? []) {
    if (count >= max) break;
    const r = projectBusinessToWorldModelPure(next, input.userId, biz, {
      dryRun: input.dryRun,
      personEntityId: report.personEntityId ?? undefined,
    });
    next = r.state;
    report = { ...mergeReports(report, r.report), personEntityId: report.personEntityId };
    count++;
  }

  for (const doc of input.documents ?? []) {
    if (count >= max) break;
    const r = projectDocumentToWorldModelPure(next, input.userId, doc, {
      dryRun: input.dryRun,
    });
    next = r.state;
    report = { ...mergeReports(report, r.report), personEntityId: report.personEntityId };
    count++;
  }

  return { state: next, report };
}
