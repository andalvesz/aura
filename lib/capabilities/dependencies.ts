/**
 * Dependency resolver — never activates partially without reporting issues.
 */

import {
  compareSemver,
  getCapability,
  getSkill,
  isCapabilityRegistered,
  isSkillRegistered,
} from "@/lib/capabilities/registry";
import {
  findCapabilityInstallation,
  findSkillInstallation,
  type PlatformState,
} from "@/lib/capabilities/store";
import type {
  DependencyIssue,
  ResolveContext,
  CapabilityDefinition,
  SkillDefinition,
} from "@/lib/capabilities/types";

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
  any: 0,
};

export function roleSatisfies(
  actual: ResolveContext["role"],
  required: ResolveContext["role"][]
): boolean {
  if (required.includes("any")) return true;
  const rank = ROLE_RANK[actual] ?? 0;
  return required.some((r) => rank >= (ROLE_RANK[r] ?? 99));
}

export function validateCapabilityAccess(
  def: CapabilityDefinition,
  ctx: ResolveContext
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  if (!roleSatisfies(ctx.role, def.requiredRoles)) {
    issues.push({
      code: "insufficient_role",
      message: `Role ${ctx.role} insufficient for ${def.id}`,
      capabilityId: def.id,
    });
  }
  if (def.privateWorkspace || def.scope === "PRIVATE_WORKSPACE") {
    const slug = ctx.workspaceSlug;
    if (!ctx.isWorkspaceMember || !slug || !def.allowedWorkspaceSlugs?.includes(slug)) {
      issues.push({
        code: "private_skill_denied",
        message: `Private capability ${def.id} denied for workspace`,
        capabilityId: def.id,
      });
    }
  }
  if (ctx.role === "viewer") {
    issues.push({
      code: "viewer_forbidden",
      message: "Viewer cannot install or mutate capabilities",
      capabilityId: def.id,
    });
  }
  return issues;
}

export function validateSkillAccess(
  def: SkillDefinition,
  ctx: ResolveContext
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  if (ctx.role === "viewer") {
    issues.push({
      code: "viewer_forbidden",
      message: "Viewer cannot install skills",
      skillId: def.id,
    });
  }
  if (def.privateWorkspace) {
    const slug = ctx.workspaceSlug;
    if (!ctx.isWorkspaceMember || !slug || !def.allowedWorkspaceSlugs?.includes(slug)) {
      issues.push({
        code: "wrong_workspace",
        message: `Skill ${def.id} is private to authorized workspace`,
        skillId: def.id,
      });
    }
  }
  return issues;
}

export function resolveCapabilityDependencies(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext,
  opts?: { requireEnabled?: boolean }
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  if (!isCapabilityRegistered(capabilityId)) {
    return [
      {
        code: "not_registered",
        message: `Capability not registered in code: ${capabilityId}`,
        capabilityId,
      },
    ];
  }
  const def = getCapability(capabilityId)!;
  issues.push(...validateCapabilityAccess(def, ctx));

  for (const dep of def.dependencies) {
    if (!isCapabilityRegistered(dep.capabilityId)) {
      if (!dep.optional) {
        issues.push({
          code: "missing_dependency",
          message: `Missing dependency ${dep.capabilityId}`,
          capabilityId,
        });
      }
      continue;
    }
    const depDef = getCapability(dep.capabilityId)!;
    if (dep.minVersion && compareSemver(depDef.version, dep.minVersion) < 0) {
      issues.push({
        code: "version_incompatible",
        message: `${dep.capabilityId} requires >= ${dep.minVersion}`,
        capabilityId: dep.capabilityId,
      });
    }
    const inst = findCapabilityInstallation(
      state,
      dep.capabilityId,
      ctx.userId,
      ctx.workspaceId
    );
    const coreOk = depDef.core;
    const installed = Boolean(inst) || coreOk;
    if (!installed && !dep.optional) {
      issues.push({
        code: "missing_dependency",
        message: `Dependency not installed: ${dep.capabilityId}`,
        capabilityId: dep.capabilityId,
      });
    }
    if (
      opts?.requireEnabled &&
      !dep.optional &&
      !depDef.core &&
      inst &&
      !inst.enabled
    ) {
      issues.push({
        code: "capability_disabled",
        message: `Dependency disabled: ${dep.capabilityId}`,
        capabilityId: dep.capabilityId,
      });
    }
    if (depDef.requiredMigrations.length > 0 && inst?.status === "migration_required") {
      issues.push({
        code: "migration_pending",
        message: `Migration pending for ${dep.capabilityId}`,
        capabilityId: dep.capabilityId,
      });
    }
  }

  for (const conflictId of def.conflicts) {
    const other = findCapabilityInstallation(
      state,
      conflictId,
      ctx.userId,
      ctx.workspaceId
    );
    if (other && other.enabled) {
      issues.push({
        code: "conflict",
        message: `Conflicts with enabled ${conflictId}`,
        capabilityId: conflictId,
      });
    }
  }

  return issues;
}

export function resolveSkillDependencies(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext
): DependencyIssue[] {
  if (!isSkillRegistered(skillId)) {
    return [
      {
        code: "not_registered",
        message: `Skill not registered: ${skillId}`,
        skillId,
      },
    ];
  }
  const def = getSkill(skillId)!;
  const issues = validateSkillAccess(def, ctx);

  for (const capId of [...def.requiredCapabilities, ...def.capabilities]) {
    issues.push(
      ...resolveCapabilityDependencies(state, capId, ctx, { requireEnabled: false }).filter(
        (i) => i.code !== "viewer_forbidden"
      )
    );
  }

  // Cross-workspace install attempt
  if (def.privateWorkspace && ctx.workspaceId) {
    const foreign = state.skillInstallations.find(
      (i) =>
        i.skillId === skillId &&
        !i.softDeleted &&
        i.workspaceId !== null &&
        i.workspaceId !== ctx.workspaceId
    );
    if (foreign && foreign.userId !== ctx.userId) {
      // enumerating another workspace's private skill is denied at access layer
    }
  }

  return issues;
}

export function canActivate(
  issues: DependencyIssue[]
): { ok: boolean; issues: DependencyIssue[] } {
  const blocking = issues.filter((i) => i.code !== "capability_disabled" || true);
  return { ok: blocking.length === 0, issues };
}
