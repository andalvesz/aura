/**
 * In-app announcements — no external communication this sprint.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type {
  AnnouncementKind,
  AnnouncementRecord,
  AnnouncementScope,
  BetaCohortId,
} from "@/lib/beta-ops/types";
import { getUserCohort } from "@/lib/beta-ops/cohorts";
import { createOpsNotification } from "@/lib/beta-ops/notifications";

export function createAnnouncementPure(
  state: BetaOpsState,
  input: {
    kind: AnnouncementKind;
    title: string;
    body: string;
    scope: AnnouncementScope;
    scopeId?: string | null;
    startsAt?: string;
    endsAt?: string | null;
    createdBy: string;
    notifyUserIds?: string[];
  }
): { state: BetaOpsState; announcement: AnnouncementRecord } {
  const announcement: AnnouncementRecord = {
    id: newId("ann"),
    kind: input.kind,
    title: input.title.trim().slice(0, 200),
    body: input.body.trim().slice(0, 4000),
    scope: input.scope,
    scopeId: input.scopeId ?? null,
    startsAt: input.startsAt ?? nowIso(),
    endsAt: input.endsAt ?? null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    softDeleted: false,
  };
  let next: BetaOpsState = {
    ...state,
    announcements: [...state.announcements, announcement],
  };
  next = pushOpsAudit(next, {
    event: "announcement_created",
    actorId: input.createdBy,
    subjectType: "announcement",
    subjectId: announcement.id,
    summary: announcement.title,
    metadata: { kind: announcement.kind, scope: announcement.scope },
    correlationId: null,
  });
  for (const uid of input.notifyUserIds ?? []) {
    next = createOpsNotification(next, {
      userId: uid,
      kind: announcement.kind,
      title: announcement.title,
      body: announcement.body.slice(0, 200),
      href: "/dashboard/changelog",
    });
  }
  return { state: next, announcement };
}

export function listVisibleAnnouncements(
  state: BetaOpsState,
  viewer: {
    userId: string;
    workspaceId: string | null;
    capabilityIds?: string[];
    now?: number;
  }
): AnnouncementRecord[] {
  const nowIsoStr = new Date(viewer.now ?? Date.now()).toISOString();
  const cohort = getUserCohort(viewer.userId);
  return state.announcements.filter((a) => {
    if (a.softDeleted) return false;
    if (a.startsAt > nowIsoStr) return false;
    if (a.endsAt && a.endsAt < nowIsoStr) return false;
    switch (a.scope) {
      case "global":
        return true;
      case "user":
        return a.scopeId === viewer.userId;
      case "workspace":
        return a.scopeId === viewer.workspaceId;
      case "cohort":
        return a.scopeId === cohort;
      case "capability":
        return Boolean(a.scopeId && viewer.capabilityIds?.includes(a.scopeId));
      default:
        return false;
    }
  });
}

export function markAnnouncementReadPure(
  state: BetaOpsState,
  userId: string,
  announcementId: string
): BetaOpsState {
  if (
    state.announcementReads.some(
      (r) => r.userId === userId && r.announcementId === announcementId
    )
  ) {
    return state;
  }
  return {
    ...state,
    announcementReads: [
      ...state.announcementReads,
      { id: newId("annr"), announcementId, userId, readAt: nowIso() },
    ],
  };
}

export function createAnnouncement(input: Parameters<typeof createAnnouncementPure>[1]) {
  const res = createAnnouncementPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function isAnnouncementInScope(
  announcement: AnnouncementRecord,
  viewerUserId: string,
  viewerWorkspaceId: string | null,
  viewerCohort: BetaCohortId | null
): boolean {
  switch (announcement.scope) {
    case "global":
      return true;
    case "user":
      return announcement.scopeId === viewerUserId;
    case "workspace":
      return announcement.scopeId === viewerWorkspaceId;
    case "cohort":
      return announcement.scopeId === viewerCohort;
    case "capability":
      return false; // need capability list — use listVisibleAnnouncements
    default:
      return false;
  }
}
