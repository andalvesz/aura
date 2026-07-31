/**
 * Installation / enable / disable / uninstall flows.
 * Only code-registered capabilities; never runs arbitrary skill migrations.
 */

import {
  getCapability,
  getSkill,
  ensurePlatformRegistries,
} from "@/lib/capabilities/registry";
import {
  resolveCapabilityDependencies,
  resolveSkillDependencies,
} from "@/lib/capabilities/dependencies";
import {
  assertNotCoreUninstall,
  canInstallCapability,
  canMutateCapability,
} from "@/lib/capabilities/permissions";
import { validateConfigAgainstSchema, validateDeclaredVersion } from "@/lib/capabilities/validation";
import { deprecationWarning, noopLifecycleHooks } from "@/lib/capabilities/lifecycle";
import {
  findCapabilityInstallation,
  findSkillInstallation,
  newId,
  nowIso,
  pushAudit,
  type PlatformState,
} from "@/lib/capabilities/store";
import type {
  DependencyIssue,
  ResolveContext,
  CapabilityInstallation,
  SkillInstallation,
} from "@/lib/capabilities/types";

export type InstallResult = {
  state: PlatformState;
  ok: boolean;
  issues: DependencyIssue[];
  installation: CapabilityInstallation | SkillInstallation | null;
  warning: string | null;
};

function deny(
  state: PlatformState,
  issues: DependencyIssue[],
  ctx: ResolveContext,
  subjectType: string,
  subjectId: string
): InstallResult {
  let s = state;
  if (issues.some((i) => i.code === "missing_dependency" || i.code === "conflict")) {
    s = pushAudit(s, {
      event: "dependency_failed",
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      subjectType,
      subjectId,
      summary: issues.map((i) => i.code).join(","),
      metadata: { codes: issues.map((i) => i.code) },
    });
  }
  return { state: s, ok: false, issues, installation: null, warning: null };
}

export function installCapabilityPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext,
  opts?: { config?: Record<string, unknown>; claimedVersion?: string; activate?: boolean }
): InstallResult {
  ensurePlatformRegistries();
  if (!canInstallCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot install", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  const def = getCapability(capabilityId);
  if (!def) {
    return deny(
      state,
      [{ code: "not_registered", message: "Not registered", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  if (opts?.claimedVersion) {
    const forged = validateDeclaredVersion(opts.claimedVersion, def.version);
    if (forged.length) return deny(state, forged, ctx, "capability", capabilityId);
  }
  const issues = resolveCapabilityDependencies(state, capabilityId, ctx);
  const config = opts?.config ?? {};
  issues.push(...validateConfigAgainstSchema(config, def.configSchema));
  if (issues.length) return deny(state, issues, ctx, "capability", capabilityId);

  const existing = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (existing) {
    return {
      state,
      ok: true,
      issues: [],
      installation: existing,
      warning: deprecationWarning(def),
    };
  }

  noopLifecycleHooks(def).install();
  const activate = opts?.activate !== false && (def.defaultEnabled || def.core);
  const row: CapabilityInstallation = {
    id: newId("capinst"),
    capabilityId,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    status: activate ? "enabled" : "installed",
    installedVersion: def.version,
    enabled: activate,
    config,
    errorMessage: null,
    installedAt: nowIso(),
    enabledAt: activate ? nowIso() : null,
    disabledAt: null,
    updatedAt: nowIso(),
    softDeleted: false,
  };
  let s = {
    ...state,
    installations: [...state.installations, row],
  };
  s = pushAudit(s, {
    event: "capability_installed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "capability",
    subjectId: capabilityId,
    summary: `Installed ${def.name}`,
    metadata: { version: def.version },
  });
  if (activate) {
    s = pushAudit(s, {
      event: "capability_enabled",
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      subjectType: "capability",
      subjectId: capabilityId,
      summary: `Enabled ${def.name}`,
      metadata: {},
    });
  }
  return {
    state: s,
    ok: true,
    issues: [],
    installation: row,
    warning: deprecationWarning(def),
  };
}

export function enableCapabilityPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext
): InstallResult {
  if (!canMutateCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot enable", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  const issues = resolveCapabilityDependencies(state, capabilityId, ctx, {
    requireEnabled: true,
  }).filter((i) => i.capabilityId !== capabilityId || i.code !== "capability_disabled");
  // Re-check deps excluding self-disabled
  const depIssues = resolveCapabilityDependencies(state, capabilityId, ctx, {
    requireEnabled: true,
  });
  const blocking = depIssues.filter(
    (i) => !(i.code === "capability_disabled" && i.capabilityId === capabilityId)
  );
  if (blocking.length) return deny(state, blocking, ctx, "capability", capabilityId);

  const inst = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (!inst) {
    return installCapabilityPure(state, capabilityId, ctx, { activate: true });
  }
  const updated: CapabilityInstallation = {
    ...inst,
    enabled: true,
    status: "enabled",
    enabledAt: nowIso(),
    disabledAt: null,
    updatedAt: nowIso(),
    errorMessage: null,
  };
  let s: PlatformState = {
    ...state,
    installations: state.installations.map((i) => (i.id === inst.id ? updated : i)),
  };
  s = pushAudit(s, {
    event: "capability_enabled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "capability",
    subjectId: capabilityId,
    summary: `Enabled ${capabilityId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function disableCapabilityPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext
): InstallResult {
  const def = getCapability(capabilityId);
  if (def?.core) {
    return deny(
      state,
      [
        {
          code: "core_protected",
          message: "Core cannot be disabled",
          capabilityId,
        },
      ],
      ctx,
      "capability",
      capabilityId
    );
  }
  if (!canMutateCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot disable", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  const inst = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (!inst) {
    return deny(
      state,
      [{ code: "not_registered", message: "Not installed", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  const updated: CapabilityInstallation = {
    ...inst,
    enabled: false,
    status: "disabled",
    disabledAt: nowIso(),
    updatedAt: nowIso(),
  };
  let s: PlatformState = {
    ...state,
    installations: state.installations.map((i) => (i.id === inst.id ? updated : i)),
  };
  s = pushAudit(s, {
    event: "capability_disabled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "capability",
    subjectId: capabilityId,
    summary: `Disabled ${capabilityId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function uninstallCapabilityPure(
  state: PlatformState,
  capabilityId: string,
  ctx: ResolveContext
): InstallResult {
  const def = getCapability(capabilityId);
  const coreErr = assertNotCoreUninstall(Boolean(def?.core));
  if (coreErr) {
    return deny(
      state,
      [{ code: "core_protected", message: coreErr, capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  if (!canMutateCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot uninstall", capabilityId }],
      ctx,
      "capability",
      capabilityId
    );
  }
  const inst = findCapabilityInstallation(
    state,
    capabilityId,
    ctx.userId,
    ctx.workspaceId
  );
  if (!inst) {
    return { state, ok: true, issues: [], installation: null, warning: null };
  }
  const updated = { ...inst, softDeleted: true, enabled: false, status: "disabled" as const, updatedAt: nowIso() };
  let s: PlatformState = {
    ...state,
    installations: state.installations.map((i) => (i.id === inst.id ? updated : i)),
  };
  s = pushAudit(s, {
    event: "capability_uninstalled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "capability",
    subjectId: capabilityId,
    summary: `Uninstalled ${capabilityId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function installSkillPure(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext,
  opts?: { config?: Record<string, unknown>; activate?: boolean }
): InstallResult {
  ensurePlatformRegistries();
  if (!canInstallCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot install skill", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  const def = getSkill(skillId);
  if (!def) {
    return deny(
      state,
      [{ code: "not_registered", message: "Skill not registered", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  const issues = resolveSkillDependencies(state, skillId, ctx);
  const config = { ...def.defaultConfig, ...(opts?.config ?? {}) };
  issues.push(...validateConfigAgainstSchema(config, def.configSchema));
  if (issues.length) return deny(state, issues, ctx, "skill", skillId);

  // Install required + bundled capabilities first (registered only)
  let s = state;
  for (const capId of [...new Set([...def.requiredCapabilities, ...def.capabilities])]) {
    const capDef = getCapability(capId);
    if (!capDef) {
      return deny(
        s,
        [{ code: "not_registered", message: `Capability ${capId} not in code`, capabilityId: capId }],
        ctx,
        "skill",
        skillId
      );
    }
    if (capDef.core) continue;
    const existing = findCapabilityInstallation(s, capId, ctx.userId, ctx.workspaceId);
    if (!existing) {
      const res = installCapabilityPure(s, capId, ctx, { activate: true });
      if (!res.ok) return deny(res.state, res.issues, ctx, "skill", skillId);
      s = res.state;
    } else if (!existing.enabled) {
      const res = enableCapabilityPure(s, capId, ctx);
      if (!res.ok) return deny(res.state, res.issues, ctx, "skill", skillId);
      s = res.state;
    }
  }

  const existingSkill = findSkillInstallation(s, skillId, ctx.userId, ctx.workspaceId);
  if (existingSkill) {
    return { state: s, ok: true, issues: [], installation: existingSkill, warning: null };
  }

  const activate = opts?.activate !== false;
  const row: SkillInstallation = {
    id: newId("skillinst"),
    skillId,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    status: activate ? "enabled" : "installed",
    installedVersion: def.version,
    enabled: activate,
    config,
    errorMessage: null,
    installedAt: nowIso(),
    enabledAt: activate ? nowIso() : null,
    disabledAt: null,
    updatedAt: nowIso(),
    softDeleted: false,
  };
  s = { ...s, skillInstallations: [...s.skillInstallations, row] };
  s = pushAudit(s, {
    event: "skill_installed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "skill",
    subjectId: skillId,
    summary: `Installed ${def.name}`,
    metadata: { version: def.version, risk: def.riskLevel },
  });
  if (activate) {
    s = pushAudit(s, {
      event: "skill_enabled",
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      subjectType: "skill",
      subjectId: skillId,
      summary: `Enabled ${def.name}`,
      metadata: {},
    });
  }
  return { state: s, ok: true, issues: [], installation: row, warning: null };
}

export function enableSkillPure(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext
): InstallResult {
  const issues = resolveSkillDependencies(state, skillId, ctx);
  if (issues.length) return deny(state, issues, ctx, "skill", skillId);
  const inst = findSkillInstallation(state, skillId, ctx.userId, ctx.workspaceId);
  if (!inst) return installSkillPure(state, skillId, ctx, { activate: true });
  const updated = {
    ...inst,
    enabled: true,
    status: "enabled" as const,
    enabledAt: nowIso(),
    disabledAt: null,
    updatedAt: nowIso(),
  };
  let s: PlatformState = {
    ...state,
    skillInstallations: state.skillInstallations.map((i) =>
      i.id === inst.id ? updated : i
    ),
  };
  s = pushAudit(s, {
    event: "skill_enabled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "skill",
    subjectId: skillId,
    summary: `Enabled ${skillId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function disableSkillPure(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext
): InstallResult {
  if (!canMutateCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot disable skill", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  const inst = findSkillInstallation(state, skillId, ctx.userId, ctx.workspaceId);
  if (!inst) {
    return deny(
      state,
      [{ code: "not_registered", message: "Skill not installed", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  const updated = {
    ...inst,
    enabled: false,
    status: "disabled" as const,
    disabledAt: nowIso(),
    updatedAt: nowIso(),
  };
  let s: PlatformState = {
    ...state,
    skillInstallations: state.skillInstallations.map((i) =>
      i.id === inst.id ? updated : i
    ),
  };
  s = pushAudit(s, {
    event: "skill_disabled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "skill",
    subjectId: skillId,
    summary: `Disabled ${skillId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function uninstallSkillPure(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext
): InstallResult {
  const def = getSkill(skillId);
  if (def && !def.uninstallable) {
    return deny(
      state,
      [{ code: "core_protected", message: "Skill not uninstallable", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  if (!canMutateCapability(ctx)) {
    return deny(
      state,
      [{ code: "viewer_forbidden", message: "Cannot uninstall skill", skillId }],
      ctx,
      "skill",
      skillId
    );
  }
  const inst = findSkillInstallation(state, skillId, ctx.userId, ctx.workspaceId);
  if (!inst) return { state, ok: true, issues: [], installation: null, warning: null };
  const updated = {
    ...inst,
    softDeleted: true,
    enabled: false,
    status: "disabled" as const,
    updatedAt: nowIso(),
  };
  let s: PlatformState = {
    ...state,
    skillInstallations: state.skillInstallations.map((i) =>
      i.id === inst.id ? updated : i
    ),
  };
  s = pushAudit(s, {
    event: "skill_uninstalled",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "skill",
    subjectId: skillId,
    summary: `Uninstalled ${skillId}`,
    metadata: {},
  });
  return { state: s, ok: true, issues: [], installation: updated, warning: null };
}

export function previewSkillInstall(
  state: PlatformState,
  skillId: string,
  ctx: ResolveContext
): {
  skill: ReturnType<typeof getSkill>;
  capabilities: string[];
  permissions: string[];
  riskLevel: string | null;
  issues: DependencyIssue[];
} {
  ensurePlatformRegistries();
  const def = getSkill(skillId);
  if (!def) {
    return {
      skill: undefined,
      capabilities: [],
      permissions: [],
      riskLevel: null,
      issues: [{ code: "not_registered", message: "Unknown skill", skillId }],
    };
  }
  return {
    skill: def,
    capabilities: [...def.requiredCapabilities, ...def.capabilities],
    permissions: def.permissions,
    riskLevel: def.riskLevel,
    issues: resolveSkillDependencies(state, skillId, ctx),
  };
}
