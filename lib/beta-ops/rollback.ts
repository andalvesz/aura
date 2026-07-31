/**
 * Rollback foundation — logical / flag / config only.
 * Never auto-destructive migration rollback.
 */

import { rollbackRolloutPure } from "@/lib/beta-ops/rollout";
import { setReleaseStatusPure } from "@/lib/beta-ops/releases";
import { getBetaOpsState, setBetaOpsState, pushOpsAudit } from "@/lib/beta-ops/store";
import { disableSkillPure, disableCapabilityPure } from "@/lib/capabilities/installation";
import { getPlatformState, setPlatformState } from "@/lib/capabilities/store";
import type { ResolveContext } from "@/lib/capabilities/types";

export const ROLLBACK_PLAYBOOK = {
  featureFlag: "Set rollout percent=0 / enabled=false via upsertRollout / rollbackRollout",
  release: "Set release status ROLLED_BACK; keep data; announce known issue",
  configuration: "Re-import previous config export; do not wipe workspaces",
  skill: "disableSkillPure — does not uninstall user data",
  capability: "disableCapabilityPure — soft disable",
  automations: "Pause automation engine via maintenance scope=capability automation",
  agents: "Pause agent runtime via maintenance scope=capability agents",
  migrations: "NEVER auto-drop tables; prefer forward fix + feature flags",
} as const;

export function executeFlagRollback(key: string, actorId: string) {
  const res = rollbackRolloutPure(getBetaOpsState(), key, actorId);
  setBetaOpsState(res.state);
  return res;
}

export function executeReleaseRollback(releaseId: string, actorId: string) {
  const res = setReleaseStatusPure(getBetaOpsState(), {
    releaseId,
    status: "ROLLED_BACK",
    actorId,
  });
  setBetaOpsState(res.state);
  return res;
}

export function executeSkillDisable(skillId: string, ctx: ResolveContext) {
  const res = disableSkillPure(getPlatformState(), skillId, ctx);
  if (res.ok) setPlatformState(res.state);
  return res;
}

export function executeCapabilityDisable(capabilityId: string, ctx: ResolveContext) {
  const res = disableCapabilityPure(getPlatformState(), capabilityId, ctx);
  if (res.ok) setPlatformState(res.state);
  return res;
}

export function documentRollbackAudit(actorId: string, action: string) {
  const next = pushOpsAudit(getBetaOpsState(), {
    event: "rollback_action",
    actorId,
    subjectType: "rollback",
    subjectId: action,
    summary: action,
    metadata: { playbook: true },
    correlationId: null,
  });
  setBetaOpsState(next);
}
