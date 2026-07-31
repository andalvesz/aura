/**
 * Gradual feature flag rollout — server-side, stable per user.
 * Never substitutes authorization.
 */

import { createHash } from "node:crypto";
import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { BetaCohortId, FeatureRollout } from "@/lib/beta-ops/types";
import { getUserCohort } from "@/lib/beta-ops/cohorts";

/** Deterministic 0–99 bucket for user+key. */
export function stablePercentBucket(userId: string, flagKey: string): number {
  const hex = createHash("sha256").update(`${flagKey}:${userId}`).digest("hex");
  return parseInt(hex.slice(0, 8), 16) % 100;
}

export function upsertRolloutPure(
  state: BetaOpsState,
  input: {
    key: string;
    percent: number;
    cohorts?: BetaCohortId[];
    userIds?: string[];
    workspaceIds?: string[];
    environment?: string | null;
    enabled?: boolean;
    reason: string;
    updatedBy: string;
  }
): { state: BetaOpsState; rollout: FeatureRollout } {
  const percent = Math.max(0, Math.min(100, Math.floor(input.percent)));
  const existingIdx = state.rollouts.findIndex((r) => r.key === input.key);
  const rollout: FeatureRollout = {
    id: existingIdx >= 0 ? state.rollouts[existingIdx]!.id : newId("roll"),
    key: input.key,
    percent,
    cohorts: input.cohorts ?? [],
    userIds: input.userIds ?? [],
    workspaceIds: input.workspaceIds ?? [],
    environment: input.environment ?? null,
    enabled: input.enabled ?? true,
    reason: input.reason.slice(0, 200),
    updatedAt: nowIso(),
    updatedBy: input.updatedBy,
  };
  const rollouts = [...state.rollouts];
  if (existingIdx >= 0) rollouts[existingIdx] = rollout;
  else rollouts.push(rollout);
  let next: BetaOpsState = { ...state, rollouts };
  next = pushOpsAudit(next, {
    event: "feature_rollout_updated",
    actorId: input.updatedBy,
    subjectType: "feature_rollout",
    subjectId: rollout.key,
    summary: `${rollout.key} percent=${rollout.percent} enabled=${rollout.enabled}`,
    metadata: {
      percent: rollout.percent,
      cohorts: rollout.cohorts,
      environment: rollout.environment,
    },
    correlationId: null,
  });
  return { state: next, rollout };
}

export function resolveRolloutPure(
  state: BetaOpsState,
  key: string,
  scope: {
    userId: string;
    workspaceId?: string | null;
    environment?: string | null;
  }
): { enabled: boolean; reason: string } {
  const rollout = state.rollouts.find((r) => r.key === key);
  if (!rollout || !rollout.enabled) {
    return { enabled: false, reason: "rollout_absent_or_disabled" };
  }
  if (rollout.environment && scope.environment && rollout.environment !== scope.environment) {
    return { enabled: false, reason: "environment_mismatch" };
  }
  if (rollout.userIds.includes(scope.userId)) {
    return { enabled: true, reason: "user_allowlist" };
  }
  if (scope.workspaceId && rollout.workspaceIds.includes(scope.workspaceId)) {
    return { enabled: true, reason: "workspace_allowlist" };
  }
  const cohort = getUserCohort(scope.userId);
  if (cohort && rollout.cohorts.includes(cohort)) {
    return { enabled: true, reason: "cohort" };
  }
  if (rollout.percent <= 0) {
    return { enabled: false, reason: "percent_zero" };
  }
  if (rollout.percent >= 100) {
    return { enabled: true, reason: "percent_100" };
  }
  const bucket = stablePercentBucket(scope.userId, key);
  if (bucket < rollout.percent) {
    return { enabled: true, reason: "percent_bucket" };
  }
  return { enabled: false, reason: "percent_bucket_miss" };
}

export function rollbackRolloutPure(
  state: BetaOpsState,
  key: string,
  actorId: string
): { state: BetaOpsState; ok: boolean; rollout: FeatureRollout } {
  const res = upsertRolloutPure(state, {
    key,
    percent: 0,
    enabled: false,
    reason: "rollback",
    updatedBy: actorId,
    cohorts: [],
    userIds: [],
    workspaceIds: [],
  });
  return { state: res.state, ok: true, rollout: res.rollout };
}

export function upsertRollout(input: Parameters<typeof upsertRolloutPure>[1]) {
  const res = upsertRolloutPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function resolveRollout(
  key: string,
  scope: Parameters<typeof resolveRolloutPure>[2]
) {
  return resolveRolloutPure(getBetaOpsState(), key, scope);
}
