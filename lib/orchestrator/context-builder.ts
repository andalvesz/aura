/**
 * Global Context Builder — answers the operating questions for Aura Home.
 * READ-ONLY coordination over module slices. No new engines.
 */

import {
  DEFAULT_AURA_PERSONALITY,
  EMPTY_SESSION_FOCUS,
  type AuraPersonality,
  type ContextHint,
  type GlobalContext,
  type GlobalContextSlice,
  type SessionFocus,
} from "@/lib/orchestrator/types";

export function emptyGlobalContextSlice(): GlobalContextSlice {
  return {
    user: null,
    workspace: null,
    activeProject: null,
    activeMission: null,
    activePlan: null,
    activeBusiness: null,
    priorities: [],
    activeAgents: [],
    automations: [],
    risks: [],
    opportunities: [],
    recommendations: [],
    discoveries: [],
    nextActions: [],
  };
}

function labelOr(hint: ContextHint | null, fallback: string): string {
  return hint?.label?.trim() || fallback;
}

function labels(list: ContextHint[], fallback: string): string[] {
  if (!list.length) return [fallback];
  return list.map((h) => h.label);
}

export function buildGlobalContext(input: {
  slice?: Partial<GlobalContextSlice>;
  session?: Partial<SessionFocus>;
  personality?: Partial<AuraPersonality>;
  correlationId?: string;
  now?: string;
}): GlobalContext {
  const raw = { ...emptyGlobalContextSlice(), ...input.slice };
  const session: SessionFocus = { ...EMPTY_SESSION_FOCUS, ...input.session };
  const personality: AuraPersonality = {
    ...DEFAULT_AURA_PERSONALITY,
    ...input.personality,
    objectives: input.personality?.objectives ?? DEFAULT_AURA_PERSONALITY.objectives,
    preferences:
      input.personality?.preferences ?? DEFAULT_AURA_PERSONALITY.preferences,
  };

  // Prefer explicit session focus when slice lacks active pointers
  const activeProject =
    raw.activeProject ??
    (session.projectId
      ? { id: session.projectId, label: `Projeto ${session.projectId.slice(0, 8)}` }
      : null);
  const activeMission =
    raw.activeMission ??
    (session.missionId
      ? { id: session.missionId, label: `Missão ${session.missionId.slice(0, 8)}` }
      : null);
  const activePlan =
    raw.activePlan ??
    (session.planId
      ? { id: session.planId, label: `Plano ${session.planId.slice(0, 8)}` }
      : null);
  const activeBusiness =
    raw.activeBusiness ??
    (session.businessId
      ? {
          id: session.businessId,
          label: `Empresa ${session.businessId.slice(0, 8)}`,
        }
      : null);
  const workspace =
    raw.workspace ??
    (session.workspaceId
      ? {
          id: session.workspaceId,
          label: `Workspace ${session.workspaceId.slice(0, 8)}`,
        }
      : session.contextMode === "personal"
        ? { id: "personal", label: "Pessoal" }
        : null);

  const slice: GlobalContextSlice = {
    ...raw,
    activeProject,
    activeMission,
    activePlan,
    activeBusiness,
    workspace,
    priorities: raw.priorities.slice(0, 12),
    activeAgents: raw.activeAgents.slice(0, 12),
    automations: raw.automations.slice(0, 12),
    risks: raw.risks.slice(0, 12),
    opportunities: raw.opportunities.slice(0, 12),
    recommendations: raw.recommendations.slice(0, 12),
    discoveries: raw.discoveries.slice(0, 12),
    nextActions: raw.nextActions.slice(0, 12),
  };

  const gaps: string[] = [];
  if (!slice.user) gaps.push("no_user");
  if (!slice.workspace) gaps.push("no_workspace");
  if (!slice.activeProject) gaps.push("no_active_project");
  if (!slice.activeMission) gaps.push("no_active_mission");
  if (!slice.activePlan) gaps.push("no_active_plan");
  if (!slice.priorities.length) gaps.push("no_priorities");
  if (!slice.activeAgents.length) gaps.push("no_active_agents");
  if (!slice.automations.length) gaps.push("no_automations");
  if (!slice.risks.length) gaps.push("no_risks");
  if (!slice.opportunities.length) gaps.push("no_opportunities");

  const sampleSize =
    (slice.user ? 1 : 0) +
    (slice.workspace ? 1 : 0) +
    (slice.activeProject ? 1 : 0) +
    (slice.activeMission ? 1 : 0) +
    (slice.activePlan ? 1 : 0) +
    (slice.activeBusiness ? 1 : 0) +
    slice.priorities.length +
    slice.activeAgents.length +
    slice.automations.length +
    slice.risks.length +
    slice.opportunities.length +
    slice.recommendations.length +
    slice.discoveries.length +
    slice.nextActions.length;

  const score = Math.min(
    100,
    Math.round(
      (slice.user ? 12 : 0) +
        (slice.workspace ? 10 : 0) +
        (slice.activeProject ? 12 : 0) +
        (slice.activeMission ? 8 : 0) +
        (slice.activePlan ? 8 : 0) +
        (slice.priorities.length ? 12 : 0) +
        (slice.activeAgents.length ? 8 : 0) +
        (slice.automations.length ? 8 : 0) +
        (slice.risks.length ? 10 : 0) +
        (slice.opportunities.length ? 12 : 0)
    )
  );

  return {
    slice,
    session: {
      ...session,
      workspaceId: session.workspaceId ?? slice.workspace?.id ?? null,
      projectId: session.projectId ?? slice.activeProject?.id ?? null,
      missionId: session.missionId ?? slice.activeMission?.id ?? null,
      planId: session.planId ?? slice.activePlan?.id ?? null,
      businessId: session.businessId ?? slice.activeBusiness?.id ?? null,
    },
    personality,
    answers: {
      whoIsTheUser: labelOr(slice.user, "Usuário desconhecido"),
      whichWorkspace: labelOr(slice.workspace, "Nenhum workspace ativo"),
      whichActiveProject: labelOr(slice.activeProject, "Nenhum projeto ativo"),
      whichMission: labelOr(slice.activeMission, "Nenhuma missão ativa"),
      whichPlan: labelOr(slice.activePlan, "Nenhum plano ativo"),
      whichPriorities: labels(slice.priorities, "Sem prioridades"),
      whichActiveAgents: labels(slice.activeAgents, "Nenhum agente ativo"),
      whichAutomations: labels(slice.automations, "Nenhuma automação"),
      whichRisks: labels(slice.risks, "Sem riscos destacados"),
      whichOpportunities: labels(slice.opportunities, "Sem oportunidades"),
    },
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: input.now ?? new Date().toISOString(),
    correlationId: input.correlationId ?? `orch_ctx_${Date.now()}`,
    readOnly: true,
  };
}
