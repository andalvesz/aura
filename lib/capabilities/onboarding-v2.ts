/**
 * Onboarding V2 — retomável, 10 etapas, sem mock data / AUTO_SAFE.
 */

import type { ExperienceMode, OnboardingAnswers, ResolveContext } from "@/lib/capabilities/types";
import { getExperiencePreset } from "@/lib/capabilities/experience-modes";
import { completePersonalOnboardingPure } from "@/lib/capabilities/onboarding";
import { installSkillPure } from "@/lib/capabilities/installation";
import { nowIso, pushAudit, type PlatformState } from "@/lib/capabilities/store";
import { recordPlatformEvent } from "@/lib/capabilities/observability";

export const ONBOARDING_V2_STEPS = [
  { id: 1, key: "welcome", title: "Boas-vindas" },
  { id: 2, key: "usage", title: "Uso pessoal ou workspace" },
  { id: 3, key: "goals", title: "Objetivos principais" },
  { id: 4, key: "experience", title: "Experience mode" },
  { id: 5, key: "skills", title: "Skills sugeridas" },
  { id: 6, key: "automation", title: "Nível inicial de automação" },
  { id: 7, key: "locale", title: "Idioma e timezone" },
  { id: 8, key: "workspace", title: "Criar ou entrar em workspace" },
  { id: 9, key: "review", title: "Revisar configuração" },
  { id: 10, key: "done", title: "Concluir" },
] as const;

export type OnboardingV2Progress = {
  step: number;
  completed: boolean;
  answers: Partial<OnboardingAnswers> & {
    experienceMode?: ExperienceMode;
    selectedSkillIds?: string[];
    workspaceChoice?: "create" | "join" | "skip";
    workspaceName?: string;
  };
  firstValueChecklist: FirstValueChecklist;
};

export type FirstValueChecklist = {
  configureAura: boolean;
  registerSomething: boolean;
  createGoal: boolean;
  installSkill: boolean;
  inviteTeam: boolean;
};

export const EMPTY_FIRST_VALUE: FirstValueChecklist = {
  configureAura: false,
  registerSomething: false,
  createGoal: false,
  installSkill: false,
  inviteTeam: false,
};

export function createOnboardingV2Progress(): OnboardingV2Progress {
  return {
    step: 1,
    completed: false,
    answers: {},
    firstValueChecklist: { ...EMPTY_FIRST_VALUE },
  };
}

export function canGoToStep(progress: OnboardingV2Progress, step: number): boolean {
  if (step < 1 || step > 10) return false;
  if (progress.completed) return step === 10;
  return step <= progress.step + 1;
}

export function advanceOnboardingStepPure(
  state: PlatformState,
  ctx: ResolveContext,
  progress: OnboardingV2Progress,
  nextStep: number,
  patch: OnboardingV2Progress["answers"] = {}
): { state: PlatformState; progress: OnboardingV2Progress; ok: boolean; error?: string } {
  if (!canGoToStep(progress, nextStep) && nextStep !== progress.step) {
    return { state, progress, ok: false, error: "invalid_step" };
  }
  const answers = { ...progress.answers, ...patch };
  const progressNext: OnboardingV2Progress = {
    ...progress,
    step: Math.min(10, Math.max(1, nextStep)),
    answers,
  };

  recordPlatformEvent({
    event: "onboarding_step_completed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    metadata: { step: progress.step, nextStep },
  });

  const s = pushAudit(state, {
    event: "onboarding_completed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "onboarding_step",
    subjectId: String(progress.step),
    summary: `Step ${progress.step} → ${nextStep}`,
    metadata: { nextStep },
  });

  // Keep onboardingByUser in sync for resume
  const merged = {
    ...s,
    onboardingByUser: {
      ...s.onboardingByUser,
      [ctx.userId]: {
        completed: false,
        answers: (answers as OnboardingAnswers) ?? null,
        experienceMode: answers.experienceMode ?? "CUSTOM",
      },
    },
  };

  return { state: merged, progress: progressNext, ok: true };
}

export function completeOnboardingV2Pure(
  state: PlatformState,
  ctx: ResolveContext,
  progress: OnboardingV2Progress,
  opts?: { installSelectedSkills?: boolean }
): { state: PlatformState; progress: OnboardingV2Progress } {
  const mode = progress.answers.experienceMode ?? "CUSTOM";
  const preset = getExperiencePreset(mode);
  const answers: OnboardingAnswers = {
    primaryGoal: progress.answers.primaryGoal ?? "Organizar minha vida com o Aura",
    usageType: progress.answers.usageType ?? "personal",
    desiredAreas: progress.answers.desiredAreas ?? [],
    workspaceSize: progress.answers.workspaceSize ?? "solo",
    automationLevel: progress.answers.automationLevel ?? "low",
    language: progress.answers.language ?? "pt-BR",
    timezone: progress.answers.timezone ?? "America/Sao_Paulo",
  };

  // Never enable AUTO_SAFE from onboarding
  void answers.automationLevel;

  let s = completePersonalOnboardingPure(state, ctx, answers, {
    installSuggestions: false,
  }).state;

  const skillIds =
    progress.answers.selectedSkillIds?.length
      ? progress.answers.selectedSkillIds
      : preset.suggestedSkillIds;

  let installed = false;
  if (opts?.installSelectedSkills) {
    for (const skillId of skillIds) {
      if (skillId === "skill.alvesz-experience") continue;
      const res = installSkillPure(s, skillId, ctx, { activate: true });
      if (res.ok) {
        s = res.state;
        installed = true;
      }
    }
  }

  const checklist: FirstValueChecklist = {
    ...progress.firstValueChecklist,
    configureAura: true,
    installSkill: installed || progress.firstValueChecklist.installSkill,
  };

  const done: OnboardingV2Progress = {
    step: 10,
    completed: true,
    answers: { ...progress.answers, experienceMode: mode, selectedSkillIds: skillIds },
    firstValueChecklist: checklist,
  };

  s = {
    ...s,
    onboardingByUser: {
      ...s.onboardingByUser,
      [ctx.userId]: {
        completed: true,
        answers,
        experienceMode: mode,
      },
    },
  };

  recordPlatformEvent({
    event: "onboarding_completed",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    metadata: { experienceMode: mode, skills: skillIds.length },
  });

  return { state: s, progress: done };
}

export function firstValueActions(): Array<{
  id: keyof FirstValueChecklist;
  label: string;
  href: string;
}> {
  return [
    { id: "configureAura", label: "Configure seu Aura", href: "/dashboard/settings/capabilities" },
    { id: "registerSomething", label: "Registre algo importante", href: "/dashboard/memoria" },
    { id: "createGoal", label: "Crie um objetivo", href: "/dashboard/missions" },
    { id: "installSkill", label: "Instale uma skill", href: "/dashboard/skills" },
    { id: "inviteTeam", label: "Convide sua equipe", href: "/dashboard/workspace" },
  ];
}

export function markFirstValueItem(
  progress: OnboardingV2Progress,
  key: keyof FirstValueChecklist
): OnboardingV2Progress {
  return {
    ...progress,
    firstValueChecklist: { ...progress.firstValueChecklist, [key]: true },
  };
}

export function resumeOnboardingFromState(
  state: PlatformState,
  userId: string
): OnboardingV2Progress {
  const row = state.onboardingByUser[userId];
  if (!row) return createOnboardingV2Progress();
  if (row.completed) {
    return {
      step: 10,
      completed: true,
      answers: {
        ...(row.answers ?? {}),
        experienceMode: row.experienceMode,
      },
      firstValueChecklist: { ...EMPTY_FIRST_VALUE, configureAura: true },
    };
  }
  return {
    step: Math.max(1, Math.min(9, 2)),
    completed: false,
    answers: {
      ...(row.answers ?? {}),
      experienceMode: row.experienceMode,
    },
    firstValueChecklist: { ...EMPTY_FIRST_VALUE },
  };
}

export function onboardingUpdatedAt(): string {
  return nowIso();
}
