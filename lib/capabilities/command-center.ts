/**
 * Command Center platform intents — activate/disable requires explicit card + permission.
 */

import {
  enableSkillPure,
  disableSkillPure,
  previewSkillInstall,
} from "@/lib/capabilities/installation";
import { resolveSkills, resolveCapabilities } from "@/lib/capabilities/resolver";
import type { PlatformState } from "@/lib/capabilities/types";
import type { ResolveContext } from "@/lib/capabilities/types";
import { canMutateCapability } from "@/lib/capabilities/permissions";

export const PLATFORM_COMMAND_PATTERNS = {
  listInstalledSkills: /quais\s+skills\s+(est[aã]o\s+)?instaladas/i,
  activateProjectSkill: /ative\s+a\s+skill\s+de\s+projetos/i,
  showSkillPermissions: /mostre\s+as\s+permiss[oõ]es\s+(desta|da)\s+skill/i,
  configureWorkspace: /configure\s+meu\s+workspace/i,
  listDisabledCapabilities: /quais\s+capacidades\s+(est[aã]o\s+)?desativadas/i,
};

export type PlatformCommandResult = {
  kind:
    | "list_skills"
    | "propose_enable_skill"
    | "skill_permissions"
    | "configure_workspace"
    | "list_disabled"
    | "unknown";
  message: string;
  requiresConfirmation: boolean;
  proposalCard: null | {
    action: "enable_skill" | "disable_skill";
    skillId: string;
    title: string;
  };
  state: PlatformState;
};

export function handlePlatformCommand(
  state: PlatformState,
  ctx: ResolveContext,
  message: string
): PlatformCommandResult {
  const text = message.trim();

  if (PLATFORM_COMMAND_PATTERNS.listInstalledSkills.test(text)) {
    const skills = resolveSkills(state, ctx).filter((s) => s.status !== "available");
    return {
      kind: "list_skills",
      message:
        skills.length === 0
          ? "Nenhuma skill instalada."
          : `Skills instaladas: ${skills.map((s) => s.definition.name).join(", ")}.`,
      requiresConfirmation: false,
      proposalCard: null,
      state,
    };
  }

  if (PLATFORM_COMMAND_PATTERNS.activateProjectSkill.test(text)) {
    const skillId = "skill.project-review";
    if (!canMutateCapability(ctx)) {
      return {
        kind: "propose_enable_skill",
        message: "Sem permissão para ativar skills.",
        requiresConfirmation: false,
        proposalCard: null,
        state,
      };
    }
    return {
      kind: "propose_enable_skill",
      message:
        "Para ativar a skill de projetos, confirme o card explícito abaixo.",
      requiresConfirmation: true,
      proposalCard: {
        action: "enable_skill",
        skillId,
        title: "Ativar Project Review",
      },
      state,
    };
  }

  if (PLATFORM_COMMAND_PATTERNS.showSkillPermissions.test(text)) {
    const preview = previewSkillInstall(state, "skill.project-review", ctx);
    return {
      kind: "skill_permissions",
      message: `Permissões: ${(preview.permissions ?? []).join(", ") || "nenhuma"}. Risco: ${preview.riskLevel ?? "—"}.`,
      requiresConfirmation: false,
      proposalCard: null,
      state,
    };
  }

  if (PLATFORM_COMMAND_PATTERNS.configureWorkspace.test(text)) {
    return {
      kind: "configure_workspace",
      message:
        "Abra /dashboard/workspace ou o onboarding de workspace para configurar nome, módulos e skills. Nenhum dado mockado será criado.",
      requiresConfirmation: false,
      proposalCard: null,
      state,
    };
  }

  if (PLATFORM_COMMAND_PATTERNS.listDisabledCapabilities.test(text)) {
    const disabled = resolveCapabilities(state, ctx).filter(
      (c) => !c.enabled && !c.definition.core
    );
    return {
      kind: "list_disabled",
      message:
        disabled.length === 0
          ? "Nenhuma capacidade opcional desativada."
          : `Desativadas: ${disabled.map((c) => c.definition.name).join(", ")}.`,
      requiresConfirmation: false,
      proposalCard: null,
      state,
    };
  }

  return {
    kind: "unknown",
    message: "",
    requiresConfirmation: false,
    proposalCard: null,
    state,
  };
}

export function confirmPlatformSkillActionPure(
  state: PlatformState,
  ctx: ResolveContext,
  action: "enable_skill" | "disable_skill",
  skillId: string
): { state: PlatformState; ok: boolean; message: string } {
  if (!canMutateCapability(ctx)) {
    return { state, ok: false, message: "Sem permissão" };
  }
  if (action === "enable_skill") {
    const res = enableSkillPure(state, skillId, ctx);
    return {
      state: res.state,
      ok: res.ok,
      message: res.ok ? "Skill ativada." : res.issues.map((i) => i.message).join("; "),
    };
  }
  const res = disableSkillPure(state, skillId, ctx);
  return {
    state: res.state,
    ok: res.ok,
    message: res.ok ? "Skill desativada." : res.issues.map((i) => i.message).join("; "),
  };
}
