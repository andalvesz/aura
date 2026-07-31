/**
 * Release management + changelog reads.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { ReleaseChannel, ReleaseRecord, ReleaseStatus } from "@/lib/beta-ops/types";
import { createOpsNotification } from "@/lib/beta-ops/notifications";

export function createReleasePure(
  state: BetaOpsState,
  input: {
    version: string;
    channel: ReleaseChannel;
    title: string;
    summary: string;
    changes?: ReleaseRecord["changes"];
    knownIssues?: string[];
    migrationRequired?: boolean;
    createdBy: string;
  }
): { state: BetaOpsState; release: ReleaseRecord } {
  const release: ReleaseRecord = {
    id: newId("rel"),
    version: input.version.trim(),
    channel: input.channel,
    status: "DRAFT",
    title: input.title.trim().slice(0, 200),
    summary: input.summary.trim().slice(0, 2000),
    changes: input.changes ?? [],
    knownIssues: input.knownIssues ?? [],
    migrationRequired: Boolean(input.migrationRequired),
    releasedAt: null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    softDeleted: false,
  };
  let next: BetaOpsState = { ...state, releases: [...state.releases, release] };
  next = pushOpsAudit(next, {
    event: "release_created",
    actorId: input.createdBy,
    subjectType: "release",
    subjectId: release.id,
    summary: `Release ${release.version} draft`,
    metadata: { channel: release.channel },
    correlationId: null,
  });
  return { state: next, release };
}

export function setReleaseStatusPure(
  state: BetaOpsState,
  input: {
    releaseId: string;
    status: ReleaseStatus;
    actorId: string;
    notifyUserIds?: string[];
  }
): { state: BetaOpsState; ok: boolean; release: ReleaseRecord | null; error?: string } {
  const idx = state.releases.findIndex((r) => r.id === input.releaseId && !r.softDeleted);
  if (idx < 0) return { state, ok: false, release: null, error: "not_found" };
  const cur = state.releases[idx]!;
  const updated: ReleaseRecord = {
    ...cur,
    status: input.status,
    releasedAt: input.status === "RELEASED" ? nowIso() : cur.releasedAt,
    updatedAt: nowIso(),
  };
  const releases = [...state.releases];
  releases[idx] = updated;
  let next: BetaOpsState = { ...state, releases };
  next = pushOpsAudit(next, {
    event: input.status === "ROLLED_BACK" ? "release_rolled_back" : "release_status",
    actorId: input.actorId,
    subjectType: "release",
    subjectId: updated.id,
    summary: `Release ${updated.version} → ${updated.status}`,
    metadata: { status: updated.status },
    correlationId: null,
  });
  if (input.status === "RELEASED") {
    for (const uid of input.notifyUserIds ?? []) {
      next = createOpsNotification(next, {
        userId: uid,
        kind: "new_version",
        title: `Nova versão ${updated.version}`,
        body: updated.summary.slice(0, 200),
        href: "/dashboard/changelog",
      });
    }
  }
  return { state: next, ok: true, release: updated };
}

export function markReleaseReadPure(
  state: BetaOpsState,
  userId: string,
  releaseId: string
): BetaOpsState {
  if (state.releaseReads.some((r) => r.userId === userId && r.releaseId === releaseId)) {
    return state;
  }
  return {
    ...state,
    releaseReads: [
      ...state.releaseReads,
      { id: newId("relr"), releaseId, userId, readAt: nowIso() },
    ],
  };
}

export function listReleasedChangelog(
  state = getBetaOpsState(),
  channel?: ReleaseChannel
): ReleaseRecord[] {
  return state.releases
    .filter(
      (r) =>
        !r.softDeleted &&
        (r.status === "RELEASED" || r.status === "ROLLED_BACK") &&
        (!channel || r.channel === channel)
    )
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""));
}

export function getCurrentReleaseVersion(state = getBetaOpsState()): string | null {
  const released = listReleasedChangelog(state).filter((r) => r.status === "RELEASED");
  return released[0]?.version ?? null;
}

export function createRelease(input: Parameters<typeof createReleasePure>[1]) {
  const res = createReleasePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function setReleaseStatus(input: Parameters<typeof setReleaseStatusPure>[1]) {
  const res = setReleaseStatusPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
