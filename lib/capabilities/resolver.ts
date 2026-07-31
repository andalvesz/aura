/**
 * Resolver — effective capabilities/skills for a user/workspace context.
 */

import {
  ensurePlatformRegistries,
  listCapabilities,
  listCoreCapabilities,
  listPublicSkills,
  getCapability,
} from "@/lib/capabilities/registry";
import {
  findCapabilityInstallation,
  findSkillInstallation,
  type PlatformState,
} from "@/lib/capabilities/store";
import { isFeatureEnabled } from "@/lib/capabilities/feature-flags";
import type {
  CapabilityDefinition,
  ResolveContext,
  SkillDefinition,
  InstallationStatus,
} from "@/lib/capabilities/types";

export type ResolvedCapability = {
  definition: CapabilityDefinition;
  status: InstallationStatus;
  enabled: boolean;
  installedVersion: string | null;
};

export type ResolvedSkill = {
  definition: SkillDefinition;
  status: InstallationStatus;
  enabled: boolean;
  installedVersion: string | null;
};

export function isCapabilityEffectivelyEnabled(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext
): boolean {
  ensurePlatformRegistries();
  const def = getCapability(capabilityId);
  if (!def) return false;
  if (def.status === "DISABLED" || def.status === "REMOVED") return false;

  if (def.privateWorkspace || def.scope === "PRIVATE_WORKSPACE") {
    const slug = ctx.workspaceSlug;
    if (!ctx.isWorkspaceMember || !slug || !def.allowedWorkspaceSlugs?.includes(slug)) {
      return false;
    }
  }

  for (const flag of def.featureFlags) {
    if (
      !isFeatureEnabled(state, flag, {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        capabilityId,
        environment: ctx.environment,
      })
    ) {
      return false;
    }
  }

  if (def.core) return true;

  const inst = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (inst) return inst.enabled && !inst.softDeleted;

  // Default-enabled optionals for existing full-access users
  return def.defaultEnabled;
}

export function resolveCapabilities(
  state: PlatformState,
  ctx: ResolveContext
): ResolvedCapability[] {
  ensurePlatformRegistries();
  return listCapabilities()
    .filter((def) => {
      if (def.privateWorkspace || def.scope === "PRIVATE_WORKSPACE") {
        const slug = ctx.workspaceSlug;
        return Boolean(
          ctx.isWorkspaceMember && slug && def.allowedWorkspaceSlugs?.includes(slug)
        );
      }
      return true;
    })
    .map((definition) => {
      const inst = findCapabilityInstallation(
        state,
        definition.id,
        ctx.userId,
        ctx.workspaceId
      );
      const enabled = isCapabilityEffectivelyEnabled(state, definition.id, ctx);
      let status: InstallationStatus = "available";
      if (definition.core) status = "enabled";
      else if (inst?.softDeleted) status = "available";
      else if (inst) status = inst.status;
      else if (definition.defaultEnabled) status = "enabled";
      return {
        definition,
        status,
        enabled,
        installedVersion: inst?.installedVersion ?? (definition.core ? definition.version : null),
      };
    });
}

export function resolveSkills(
  state: PlatformState,
  ctx: ResolveContext
): ResolvedSkill[] {
  ensurePlatformRegistries();
  const skills = listPublicSkills({
    includePrivate: true,
    workspaceSlug: ctx.workspaceSlug,
  });
  return skills.map((definition) => {
    const inst = findSkillInstallation(
      state,
      definition.id,
      ctx.userId,
      ctx.workspaceId
    );
    const enabled = Boolean(inst && inst.enabled && !inst.softDeleted);
    let status: InstallationStatus = "available";
    if (inst && !inst.softDeleted) status = inst.status;
    return {
      definition,
      status,
      enabled,
      installedVersion: inst?.installedVersion ?? null,
    };
  });
}

export function bootstrapCoreInstallations(
  state: PlatformState,
  ctx: ResolveContext
): PlatformState {
  ensurePlatformRegistries();
  const cores = listCoreCapabilities();
  const now = new Date().toISOString();
  const additions = cores
    .filter(
      (c) => !findCapabilityInstallation(state, c.id, ctx.userId, ctx.workspaceId)
    )
    .map((c) => ({
      id: `core_${c.id}_${ctx.userId}`,
      capabilityId: c.id,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      status: "enabled" as const,
      installedVersion: c.version,
      enabled: true,
      config: {},
      errorMessage: null,
      installedAt: now,
      enabledAt: now,
      disabledAt: null,
      updatedAt: now,
      softDeleted: false,
    }));
  if (!additions.length) return state;
  return { ...state, installations: [...state.installations, ...additions] };
}

export function skillCenterSections(resolved: ResolvedSkill[]) {
  return {
    installed: resolved.filter((s) => s.status !== "available"),
    available: resolved.filter((s) => s.status === "available"),
    active: resolved.filter((s) => s.enabled),
    disabled: resolved.filter(
      (s) => s.status === "disabled" || (s.status === "installed" && !s.enabled)
    ),
    private: resolved.filter((s) => s.definition.visibility === "PRIVATE" || s.definition.privateWorkspace),
    workspace: resolved.filter((s) => s.definition.visibility === "WORKSPACE"),
    pendingDependencies: resolved.filter((s) => s.status === "pending_dependencies"),
    error: resolved.filter((s) => s.status === "error"),
  };
}
