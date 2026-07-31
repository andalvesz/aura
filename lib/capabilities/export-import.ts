/**
 * Safe configuration export / import — versioned JSON, no secrets.
 */

import {
  ensurePlatformRegistries,
  getCapability,
  getSkill,
  isCapabilityRegistered,
  isSkillRegistered,
} from "@/lib/capabilities/registry";
import { installCapabilityPure, installSkillPure } from "@/lib/capabilities/installation";
import { validateExportSchema } from "@/lib/capabilities/validation";
import {
  nowIso,
  pushAudit,
  sanitizeExportConfig,
  type PlatformState,
} from "@/lib/capabilities/store";
import type {
  ConfigExportBundle,
  DependencyIssue,
  ExperienceMode,
  ResolveContext,
} from "@/lib/capabilities/types";

export function exportConfigurationPure(
  state: PlatformState,
  ctx: ResolveContext
): { state: PlatformState; bundle: ConfigExportBundle } {
  ensurePlatformRegistries();
  const caps = state.installations
    .filter(
      (i) =>
        !i.softDeleted &&
        i.userId === ctx.userId &&
        i.workspaceId === ctx.workspaceId
    )
    .map((i) => ({
      capabilityId: i.capabilityId,
      enabled: i.enabled,
      version: i.installedVersion,
      config: sanitizeExportConfig(i.config),
    }));

  const skills = state.skillInstallations
    .filter(
      (i) =>
        !i.softDeleted &&
        i.userId === ctx.userId &&
        i.workspaceId === ctx.workspaceId &&
        // Never export private workspace skills publicly
        getSkill(i.skillId)?.visibility !== "PRIVATE" &&
        !getSkill(i.skillId)?.privateWorkspace
    )
    .map((i) => ({
      skillId: i.skillId,
      enabled: i.enabled,
      version: i.installedVersion,
      config: sanitizeExportConfig(i.config),
    }));

  const onboarding = state.onboardingByUser[ctx.userId];
  const bundle: ConfigExportBundle = {
    formatVersion: "aura-platform-config/v1",
    exportedAt: nowIso(),
    capabilities: caps,
    skills,
    navigationOrder: state.navigationOrderByUser[ctx.userId] ?? [],
    templates: state.templates.filter((t) => !t.system).map((t) => t.id),
    preferences: {
      language: onboarding?.answers?.language ?? "pt-BR",
      timezone: onboarding?.answers?.timezone ?? "America/Sao_Paulo",
    },
    experienceMode: (onboarding?.experienceMode ?? "CUSTOM") as ExperienceMode,
  };

  const s = pushAudit(state, {
    event: "configuration_exported",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "config",
    subjectId: "export",
    summary: "Configuration exported",
    metadata: {
      capabilities: caps.length,
      skills: skills.length,
    },
  });

  return { state: s, bundle };
}

export function previewImportPure(
  bundle: unknown
): { ok: boolean; issues: DependencyIssue[]; preview: ConfigExportBundle | null } {
  const issues = validateExportSchema(bundle);
  if (issues.length) return { ok: false, issues, preview: null };
  const b = bundle as ConfigExportBundle;
  for (const c of b.capabilities) {
    if (!isCapabilityRegistered(c.capabilityId)) {
      issues.push({
        code: "not_registered",
        message: `Unknown capability ${c.capabilityId}`,
        capabilityId: c.capabilityId,
      });
    } else {
      const def = getCapability(c.capabilityId)!;
      if (c.version && c.version !== def.version) {
        // Warn as version_forged only if trying to escalate; allow older as updateAvailable
        if (c.version.split(".")[0] !== def.version.split(".")[0]) {
          issues.push({
            code: "version_incompatible",
            message: `Major version mismatch for ${c.capabilityId}`,
            capabilityId: c.capabilityId,
          });
        }
      }
    }
  }
  for (const sk of b.skills) {
    if (!isSkillRegistered(sk.skillId)) {
      issues.push({
        code: "not_registered",
        message: `Unknown skill ${sk.skillId}`,
        skillId: sk.skillId,
      });
    }
    if (getSkill(sk.skillId)?.privateWorkspace) {
      issues.push({
        code: "private_skill_denied",
        message: `Private skill cannot be imported: ${sk.skillId}`,
        skillId: sk.skillId,
      });
    }
  }
  return { ok: issues.length === 0, issues, preview: b };
}

export function importConfigurationPure(
  state: PlatformState,
  ctx: ResolveContext,
  bundle: unknown,
  opts?: { confirmed?: boolean }
): { state: PlatformState; ok: boolean; issues: DependencyIssue[] } {
  if (!opts?.confirmed) {
    return {
      state,
      ok: false,
      issues: [{ code: "schema_invalid", message: "Import requires confirmation" }],
    };
  }
  const preview = previewImportPure(bundle);
  if (!preview.ok || !preview.preview) {
    return { state, ok: false, issues: preview.issues };
  }
  const b = preview.preview;
  let s = state;

  for (const c of b.capabilities) {
    const def = getCapability(c.capabilityId);
    if (!def || def.core) continue;
    if (def.privateWorkspace) continue;
    const res = installCapabilityPure(s, c.capabilityId, ctx, {
      config: sanitizeExportConfig(c.config),
      activate: c.enabled,
    });
    if (res.ok) s = res.state;
  }

  for (const sk of b.skills) {
    if (getSkill(sk.skillId)?.privateWorkspace) continue;
    const res = installSkillPure(s, sk.skillId, ctx, {
      config: sanitizeExportConfig(sk.config),
      activate: sk.enabled,
    });
    if (res.ok) s = res.state;
  }

  s = {
    ...s,
    navigationOrderByUser: {
      ...s.navigationOrderByUser,
      [ctx.userId]: b.navigationOrder ?? [],
    },
    onboardingByUser: {
      ...s.onboardingByUser,
      [ctx.userId]: {
        completed: s.onboardingByUser[ctx.userId]?.completed ?? false,
        answers: s.onboardingByUser[ctx.userId]?.answers ?? null,
        experienceMode: b.experienceMode ?? "CUSTOM",
      },
    },
  };

  s = pushAudit(s, {
    event: "configuration_imported",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "config",
    subjectId: "import",
    summary: "Configuration imported",
    metadata: {
      capabilities: b.capabilities.length,
      skills: b.skills.length,
    },
  });

  return { state: s, ok: true, issues: [] };
}
