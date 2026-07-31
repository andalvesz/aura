/**
 * Capability / skill configuration updates.
 */

import { getCapability, getSkill } from "@/lib/capabilities/registry";
import { canMutateCapability } from "@/lib/capabilities/permissions";
import { validateConfigAgainstSchema } from "@/lib/capabilities/validation";
import {
  findCapabilityInstallation,
  findSkillInstallation,
  nowIso,
  pushAudit,
  type PlatformState,
} from "@/lib/capabilities/store";
import type { DependencyIssue, ResolveContext } from "@/lib/capabilities/types";

export function updateCapabilityConfigPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext,
  config: Record<string, unknown>
): { state: PlatformState; ok: boolean; issues: DependencyIssue[] } {
  if (!canMutateCapability(ctx)) {
    return {
      state,
      ok: false,
      issues: [{ code: "viewer_forbidden", message: "Cannot update config" }],
    };
  }
  const def = getCapability(capabilityId);
  if (!def) {
    return {
      state,
      ok: false,
      issues: [{ code: "not_registered", message: "Unknown capability", capabilityId }],
    };
  }
  const issues = validateConfigAgainstSchema(config, def.configSchema);
  if (issues.length) return { state, ok: false, issues };

  const inst = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (!inst) {
    return {
      state,
      ok: false,
      issues: [{ code: "not_registered", message: "Not installed", capabilityId }],
    };
  }
  let s: PlatformState = {
    ...state,
    installations: state.installations.map((i) =>
      i.id === inst.id
        ? { ...i, config, updatedAt: nowIso() }
        : i
    ),
  };
  s = pushAudit(s, {
    event: "config_updated",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "capability",
    subjectId: capabilityId,
    summary: "Capability config updated",
    metadata: { keys: Object.keys(config) },
  });
  return { state: s, ok: true, issues: [] };
}

export function updateSkillConfigPure(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext,
  config: Record<string, unknown>
): { state: PlatformState; ok: boolean; issues: DependencyIssue[] } {
  if (!canMutateCapability(ctx)) {
    return {
      state,
      ok: false,
      issues: [{ code: "viewer_forbidden", message: "Cannot update skill config" }],
    };
  }
  const def = getSkill(skillId);
  if (!def) {
    return {
      state,
      ok: false,
      issues: [{ code: "not_registered", message: "Unknown skill", skillId }],
    };
  }
  const issues = validateConfigAgainstSchema(config, def.configSchema);
  if (issues.length) return { state, ok: false, issues };
  const inst = findSkillInstallation(state, skillId, ctx.userId, ctx.workspaceId);
  if (!inst) {
    return {
      state,
      ok: false,
      issues: [{ code: "not_registered", message: "Skill not installed", skillId }],
    };
  }
  let s: PlatformState = {
    ...state,
    skillInstallations: state.skillInstallations.map((i) =>
      i.id === inst.id ? { ...i, config, updatedAt: nowIso() } : i
    ),
  };
  s = pushAudit(s, {
    event: "config_updated",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "skill",
    subjectId: skillId,
    summary: "Skill config updated",
    metadata: { keys: Object.keys(config) },
  });
  return { state: s, ok: true, issues: [] };
}

export function restoreDefaultCapabilityConfigPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext
) {
  return updateCapabilityConfigPure(state, capabilityId, ctx, {});
}
