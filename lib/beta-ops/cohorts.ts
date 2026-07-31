/**
 * Beta cohorts — grouping for flags/onboarding/limits/feedback.
 * NEVER used as authorization.
 */

import type { BetaCohortConfig, BetaCohortId } from "@/lib/beta-ops/types";
import { getBetaOpsState } from "@/lib/beta-ops/store";

export const BETA_COHORTS: Record<BetaCohortId, BetaCohortConfig> = {
  FOUNDERS: {
    id: "FOUNDERS",
    label: "Founders",
    featureFlags: { "beta.founders_tools": true, "beta.advanced_agents": true },
    suggestedSkillIds: ["skill.project-review", "skill.daily-brief"],
    onboardingVariant: "founders",
    technicalLimits: { maxSkills: 40, maxAutomations: 50, maxAgents: 20 },
    feedbackFormId: "feedback.founders",
    releaseChannel: "INTERNAL",
  },
  PERSONAL_USERS: {
    id: "PERSONAL_USERS",
    label: "Personal users",
    featureFlags: { "beta.personal_home": true },
    suggestedSkillIds: ["skill.daily-brief"],
    onboardingVariant: "personal",
    technicalLimits: { maxSkills: 15, maxAutomations: 10, maxAgents: 5 },
    feedbackFormId: "feedback.personal",
    releaseChannel: "BETA",
  },
  CREATORS: {
    id: "CREATORS",
    label: "Creators",
    featureFlags: { "beta.creator_tools": true },
    suggestedSkillIds: ["skill.content-capture"],
    onboardingVariant: "creators",
    technicalLimits: { maxSkills: 20, maxAutomations: 20, maxAgents: 8 },
    feedbackFormId: "feedback.creators",
    releaseChannel: "BETA",
  },
  BUSINESSES: {
    id: "BUSINESSES",
    label: "Businesses",
    featureFlags: { "beta.business_hub": true },
    suggestedSkillIds: ["skill.project-review"],
    onboardingVariant: "business",
    technicalLimits: { maxSkills: 30, maxAutomations: 40, maxAgents: 15 },
    feedbackFormId: "feedback.business",
    releaseChannel: "BETA",
  },
  TEAMS: {
    id: "TEAMS",
    label: "Teams",
    featureFlags: { "beta.team_collab": true },
    suggestedSkillIds: ["skill.project-review", "skill.daily-brief"],
    onboardingVariant: "teams",
    technicalLimits: { maxSkills: 25, maxAutomations: 30, maxAgents: 12 },
    feedbackFormId: "feedback.teams",
    releaseChannel: "BETA",
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Custom",
    featureFlags: {},
    suggestedSkillIds: [],
    onboardingVariant: "custom",
    technicalLimits: { maxSkills: 20, maxAutomations: 20, maxAgents: 10 },
    feedbackFormId: "feedback.general",
    releaseChannel: "BETA",
  },
};

export function getCohort(id: BetaCohortId): BetaCohortConfig {
  return BETA_COHORTS[id];
}

export function listCohorts(): BetaCohortConfig[] {
  return Object.values(BETA_COHORTS);
}

export function assignUserCohort(userId: string, cohort: BetaCohortId): void {
  const s = getBetaOpsState();
  s.userCohorts[userId] = cohort;
}

export function getUserCohort(userId: string): BetaCohortId | null {
  const raw = getBetaOpsState().userCohorts[userId];
  if (!raw) return null;
  return (Object.keys(BETA_COHORTS) as BetaCohortId[]).includes(raw as BetaCohortId)
    ? (raw as BetaCohortId)
    : "CUSTOM";
}

/** Cohorts never authorize — this always returns true for access checks. */
export function cohortIsNotAuthorization(): true {
  return true;
}
