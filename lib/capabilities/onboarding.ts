/**
 * Personalized onboarding — no mock data, no assumed identity, no auto autonomy.
 */

import {
  getExperiencePreset,
  type ExperiencePreset,
} from "@/lib/capabilities/experience-modes";
import { installSkillPure } from "@/lib/capabilities/installation";
import { upsertWorkspaceBrandingPure } from "@/lib/capabilities/branding";
import {
  nowIso,
  pushAudit,
  type PlatformState,
} from "@/lib/capabilities/store";
import type {
  ExperienceMode,
  OnboardingAnswers,
  ResolveContext,
  WorkspaceOnboardingInput,
} from "@/lib/capabilities/types";

export function suggestFromOnboarding(answers: OnboardingAnswers): {
  skills: string[];
  modules: string[];
  experienceMode: ExperienceMode;
} {
  let mode: ExperienceMode = "PERSONAL";
  if (answers.usageType === "business") mode = "BUSINESS";
  else if (answers.usageType === "both") mode = "CUSTOM";
  if (answers.workspaceSize !== "solo" && answers.usageType !== "personal") {
    mode = mode === "BUSINESS" ? "TEAM" : mode;
  }
  if (answers.desiredAreas.includes("creator")) mode = "CREATOR";

  const preset = getExperiencePreset(mode);
  const areaMap: Record<string, string[]> = {
    finance: ["skill.financial-organization"],
    health: ["skill.health-routine"],
    projects: ["skill.project-review"],
    knowledge: ["skill.knowledge-organization"],
    business: ["skill.business-idea-preparation"],
    missions: ["skill.mission-planning"],
    content: ["skill.content-preparation"],
    travel: ["module.viagens"],
    languages: ["module.idiomas"],
  };
  const extraSkills: string[] = [];
  const extraModules: string[] = [];
  for (const area of answers.desiredAreas) {
    for (const id of areaMap[area] ?? []) {
      if (id.startsWith("skill.")) extraSkills.push(id);
      else extraModules.push(id);
    }
  }

  // Never auto-enable high automation / autonomy
  void answers.automationLevel;

  return {
    experienceMode: mode,
    skills: [...new Set([...preset.suggestedSkillIds, ...extraSkills])],
    modules: [...new Set([...preset.suggestedCapabilityIds, ...extraModules])],
  };
}

export function completePersonalOnboardingPure(
  state: PlatformState,
  ctx: ResolveContext,
  answers: OnboardingAnswers,
  opts?: { installSuggestions?: boolean }
): {
  state: PlatformState;
  suggestions: ReturnType<typeof suggestFromOnboarding>;
  preset: ExperiencePreset;
} {
  const suggestions = suggestFromOnboarding(answers);
  const preset = getExperiencePreset(suggestions.experienceMode);
  let s: PlatformState = {
    ...state,
    onboardingByUser: {
      ...state.onboardingByUser,
      [ctx.userId]: {
        completed: true,
        answers: {
          ...answers,
          primaryGoal: answers.primaryGoal.slice(0, 200),
          language: answers.language || "pt-BR",
          timezone: answers.timezone || "America/Sao_Paulo",
        },
        experienceMode: suggestions.experienceMode,
      },
    },
  };

  if (opts?.installSuggestions) {
    for (const skillId of suggestions.skills) {
      // Skip private Alvesz for new generic users
      if (skillId === "skill.alvesz-experience") continue;
      const res = installSkillPure(s, skillId, ctx, { activate: true });
      if (res.ok) s = res.state;
    }
  }

  s = pushAudit(s, {
    event: "onboarding_completed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "onboarding",
    subjectId: ctx.userId,
    summary: "Personal onboarding completed",
    metadata: {
      experienceMode: suggestions.experienceMode,
      usageType: answers.usageType,
      areas: answers.desiredAreas,
    },
  });

  return { state: s, suggestions, preset };
}

export function completeWorkspaceOnboardingPure(
  state: PlatformState,
  ctx: ResolveContext,
  input: WorkspaceOnboardingInput
): { state: PlatformState; ok: boolean; error?: string } {
  if (!ctx.workspaceId) {
    return { state, ok: false, error: "workspace_required" };
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { state, ok: false, error: "insufficient_role" };
  }

  let s = upsertWorkspaceBrandingPure(state, {
    workspaceId: ctx.workspaceId,
    name: input.name.slice(0, 80) || "Workspace",
    logoUrl: input.branding.logoUrl ?? null,
    primaryColor: input.branding.primaryColor ?? null,
    description: input.branding.description ?? input.segment.slice(0, 280),
    icon: input.branding.icon ?? null,
  });

  for (const skillId of input.skillIds) {
    if (skillId === "skill.alvesz-experience" && ctx.workspaceSlug !== "alvesz") {
      continue;
    }
    const res = installSkillPure(s, skillId, ctx, { activate: true });
    if (res.ok) s = res.state;
  }

  s = pushAudit(s, {
    event: "onboarding_completed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "workspace_onboarding",
    subjectId: ctx.workspaceId,
    summary: "Workspace onboarding completed",
    metadata: {
      segment: input.segment,
      modules: input.moduleIds.length,
      skills: input.skillIds.length,
      members: input.memberEmails.length,
      // emails not stored in audit
    },
    createdAt: nowIso(),
  });

  return { state: s, ok: true };
}

export function getOnboardingStatus(state: PlatformState, userId: string) {
  return (
    state.onboardingByUser[userId] ?? {
      completed: false,
      answers: null,
      experienceMode: "CUSTOM" as ExperienceMode,
    }
  );
}
