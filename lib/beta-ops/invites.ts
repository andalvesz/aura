/**
 * Beta invites — token plaintext never persisted; only SHA-256 hash.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { BetaCohortId, BetaInvite } from "@/lib/beta-ops/types";
import { ensureBetaActive } from "@/lib/capabilities/beta-access-store";
import { resolvePublicSiteUrl, buildBetaInviteUrl } from "@/lib/site-url";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createBetaInvitePure(
  state: BetaOpsState,
  input: {
    email: string;
    cohort: BetaCohortId;
    createdBy: string;
    experienceModeSuggested?: string | null;
    workspaceMode?: BetaInvite["workspaceMode"];
    expiresInDays?: number;
    correlationId?: string | null;
  }
): {
  state: BetaOpsState;
  invite: BetaInvite;
  token: string;
  acceptUrl: string;
} {
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const now = Date.now();
  const expiresInDays = input.expiresInDays ?? 14;
  const invite: BetaInvite = {
    id: newId("binv"),
    email: input.email.trim().toLowerCase(),
    status: "PENDING",
    tokenHash,
    cohort: input.cohort,
    experienceModeSuggested: input.experienceModeSuggested ?? null,
    workspaceMode: input.workspaceMode ?? null,
    expiresAt: new Date(now + expiresInDays * 24 * 60 * 60_000).toISOString(),
    createdBy: input.createdBy,
    acceptedBy: null,
    acceptedAt: null,
    revokedAt: null,
    createdAt: nowIso(now),
    softDeleted: false,
  };
  let next: BetaOpsState = {
    ...state,
    invites: [...state.invites, invite],
  };
  next = pushOpsAudit(next, {
    event: "beta_invite_created",
    actorId: input.createdBy,
    subjectType: "beta_invite",
    subjectId: invite.id,
    summary: `Invite created for cohort ${invite.cohort}`,
    metadata: { cohort: invite.cohort, expiresAt: invite.expiresAt },
    correlationId: input.correlationId ?? null,
  });
  const base = resolvePublicSiteUrl();
  const acceptUrl = buildBetaInviteUrl(base, token);
  return { state: next, invite, token, acceptUrl };
}

export function revokeBetaInvitePure(
  state: BetaOpsState,
  inviteId: string,
  actorId: string
): { state: BetaOpsState; ok: boolean; error?: string } {
  const idx = state.invites.findIndex((i) => i.id === inviteId && !i.softDeleted);
  if (idx < 0) return { state, ok: false, error: "not_found" };
  const inv = state.invites[idx]!;
  if (inv.status !== "PENDING") return { state, ok: false, error: "not_pending" };
  const updated: BetaInvite = {
    ...inv,
    status: "REVOKED",
    revokedAt: nowIso(),
  };
  const invites = [...state.invites];
  invites[idx] = updated;
  let next: BetaOpsState = { ...state, invites };
  next = pushOpsAudit(next, {
    event: "beta_invite_revoked",
    actorId,
    subjectType: "beta_invite",
    subjectId: inviteId,
    summary: "Invite revoked",
    metadata: {},
    correlationId: null,
  });
  return { state: next, ok: true };
}

export function expireStaleInvitesPure(state: BetaOpsState, now = Date.now()): BetaOpsState {
  const iso = new Date(now).toISOString();
  return {
    ...state,
    invites: state.invites.map((i) => {
      if (i.softDeleted || i.status !== "PENDING") return i;
      if (i.expiresAt <= iso) return { ...i, status: "EXPIRED" as const };
      return i;
    }),
  };
}

export function acceptBetaInvitePure(
  state: BetaOpsState,
  input: {
    token: string;
    userId: string;
    userEmail: string;
    correlationId?: string | null;
  }
): { state: BetaOpsState; ok: boolean; invite: BetaInvite | null; error?: string } {
  let s = expireStaleInvitesPure(state);
  const hash = hashInviteToken(input.token);
  const idx = s.invites.findIndex((i) => i.tokenHash === hash && !i.softDeleted);
  if (idx < 0) return { state: s, ok: false, invite: null, error: "invalid_token" };
  const inv = s.invites[idx]!;
  if (inv.status === "EXPIRED") return { state: s, ok: false, invite: inv, error: "expired" };
  if (inv.status === "REVOKED") return { state: s, ok: false, invite: inv, error: "revoked" };
  if (inv.status === "ACCEPTED") return { state: s, ok: false, invite: inv, error: "already_used" };
  if (inv.status !== "PENDING") return { state: s, ok: false, invite: inv, error: "not_pending" };
  if (inv.email !== input.userEmail.trim().toLowerCase()) {
    return { state: s, ok: false, invite: inv, error: "email_mismatch" };
  }
  const updated: BetaInvite = {
    ...inv,
    status: "ACCEPTED",
    acceptedBy: input.userId,
    acceptedAt: nowIso(),
  };
  const invites = [...s.invites];
  invites[idx] = updated;
  s = {
    ...s,
    invites,
    userCohorts: { ...s.userCohorts, [input.userId]: inv.cohort },
  };
  ensureBetaActive(input.userId, inv.cohort);
  s = pushOpsAudit(s, {
    event: "beta_invite_accepted",
    actorId: input.userId,
    subjectType: "beta_invite",
    subjectId: inv.id,
    summary: "Invite accepted",
    metadata: { cohort: inv.cohort },
    correlationId: input.correlationId ?? null,
  });
  return { state: s, ok: true, invite: updated };
}

export function listBetaInvites(state: BetaOpsState = getBetaOpsState()): BetaInvite[] {
  return state.invites.filter((i) => !i.softDeleted);
}

/** Convenience for actions — mutates global store. */
export function createBetaInvite(input: Parameters<typeof createBetaInvitePure>[1]) {
  const res = createBetaInvitePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function acceptBetaInvite(input: Parameters<typeof acceptBetaInvitePure>[1]) {
  const res = acceptBetaInvitePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
