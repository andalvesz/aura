/**
 * Private beta access foundation — current users stay ACTIVE.
 */

import { newId, nowIso } from "@/lib/capabilities/store";

export type BetaAccessStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";

export type BetaAccessRecord = {
  id: string;
  userId: string;
  accessStatus: BetaAccessStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  betaCohort: string | null;
  adminNotes: string;
  updatedAt: string;
  createdAt: string;
  softDeleted: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __AURA_BETA_ACCESS__: Map<string, BetaAccessRecord> | undefined;
}

function map(): Map<string, BetaAccessRecord> {
  if (!globalThis.__AURA_BETA_ACCESS__) {
    globalThis.__AURA_BETA_ACCESS__ = new Map();
  }
  return globalThis.__AURA_BETA_ACCESS__;
}

export function clearBetaAccessStore(): void {
  globalThis.__AURA_BETA_ACCESS__ = new Map();
}

/** Existing users remain ACTIVE (Sprint 10.1). */
export function ensureBetaActive(userId: string, cohort = "legacy_active"): BetaAccessRecord {
  const existing = map().get(userId);
  if (existing && !existing.softDeleted) return existing;
  const now = nowIso();
  const row: BetaAccessRecord = {
    id: newId("beta"),
    userId,
    accessStatus: "ACTIVE",
    invitedAt: null,
    activatedAt: now,
    suspendedAt: null,
    betaCohort: cohort,
    adminNotes: "",
    updatedAt: now,
    createdAt: now,
    softDeleted: false,
  };
  map().set(userId, row);
  return row;
}

export function getBetaAccess(userId: string): BetaAccessRecord | null {
  const row = map().get(userId);
  if (!row || row.softDeleted) return null;
  return row;
}

export function canAccessBeta(userId: string): boolean {
  const row = ensureBetaActive(userId);
  return row.accessStatus === "ACTIVE" || row.accessStatus === "INVITED";
}

export function suspendBetaAccess(
  actorUserId: string,
  targetUserId: string,
  notes = ""
): { ok: boolean; record: BetaAccessRecord | null; error?: string } {
  if (actorUserId === targetUserId) {
    return { ok: false, record: null, error: "cannot_suspend_self" };
  }
  const row = ensureBetaActive(targetUserId);
  const next: BetaAccessRecord = {
    ...row,
    accessStatus: "SUSPENDED",
    suspendedAt: nowIso(),
    adminNotes: notes.slice(0, 200),
    updatedAt: nowIso(),
  };
  map().set(targetUserId, next);
  return { ok: true, record: next };
}

export function reactivateBetaAccess(targetUserId: string): BetaAccessRecord {
  const row = ensureBetaActive(targetUserId);
  const next: BetaAccessRecord = {
    ...row,
    accessStatus: "ACTIVE",
    suspendedAt: null,
    activatedAt: nowIso(),
    updatedAt: nowIso(),
  };
  map().set(targetUserId, next);
  return next;
}

export function inviteBetaUser(userId: string, cohort: string): BetaAccessRecord {
  const now = nowIso();
  const row: BetaAccessRecord = {
    id: newId("beta"),
    userId,
    accessStatus: "INVITED",
    invitedAt: now,
    activatedAt: null,
    suspendedAt: null,
    betaCohort: cohort,
    adminNotes: "",
    updatedAt: now,
    createdAt: now,
    softDeleted: false,
  };
  map().set(userId, row);
  return row;
}

export function listBetaAccessAggregated(): {
  total: number;
  byStatus: Record<BetaAccessStatus, number>;
} {
  const byStatus: Record<BetaAccessStatus, number> = {
    INVITED: 0,
    ACTIVE: 0,
    SUSPENDED: 0,
    REVOKED: 0,
  };
  let total = 0;
  for (const row of map().values()) {
    if (row.softDeleted) continue;
    total += 1;
    byStatus[row.accessStatus] += 1;
  }
  return { total, byStatus };
}
