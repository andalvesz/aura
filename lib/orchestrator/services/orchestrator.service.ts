/**
 * Orchestrator service — assembles Global Context / Aura Home from existing facades.
 * Failures per module are swallowed so Home never hard-fails.
 */

import { buildAuraHome } from "@/lib/orchestrator/home";
import {
  getOrchestratorSession,
  switchWorkspaceContext,
} from "@/lib/orchestrator/session";
import { cacheGetOrSet, clearOrchestratorCache } from "@/lib/orchestrator/cache";
import { mapLegacyTimelineKind, type TimelineInputEvent } from "@/lib/orchestrator/timeline";
import type {
  AuraHomeModel,
  AuraPersonality,
  ContextHint,
  GlobalContext,
  SessionFocus,
} from "@/lib/orchestrator/types";
import { getDataContext } from "@/lib/supabase/services/context";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function hint(id: string, label: string, href?: string, score?: number): ContextHint {
  return { id, label, href: href ?? null, score };
}

export async function loadOrchestratorHome(options?: {
  bypassCache?: boolean;
}): Promise<AuraHomeModel> {
  const ctx = await getDataContext();
  const cacheKey = `aura-home:${ctx.userId}:${ctx.activeWorkspaceId ?? "personal"}`;
  if (options?.bypassCache) clearOrchestratorCache();

  return cacheGetOrSet(cacheKey, 12_000, async () => {
    const session = getOrchestratorSession(ctx.userId);
    // Keep session workspace aligned with profile context
    if (
      (ctx.activeWorkspaceId && session.focus.workspaceId !== ctx.activeWorkspaceId) ||
      (!ctx.activeWorkspaceId && session.focus.contextMode === "workspace")
    ) {
      switchWorkspaceContext(ctx.userId, {
        contextMode: ctx.activeWorkspaceId ? "workspace" : "personal",
        workspaceId: ctx.activeWorkspaceId,
        resetFocus: false,
      });
    }
    const focus = getOrchestratorSession(ctx.userId).focus;
    const personality = getOrchestratorSession(ctx.userId).personality;

    const [
      priorityWidget,
      recommendationWidget,
      planWidget,
      automationWidget,
      agentWidget,
      projectsWidget,
      timelineRaw,
      memories,
    ] = await Promise.all([
      safe(
        async () => {
          const { getHomePriorityWidget } = await import(
            "@/lib/supabase/services/prioritization.service"
          );
          return getHomePriorityWidget();
        },
        { weekPriorities: [] as Array<{ id: string; title: string; priorityScore: number; ranking: number | null }> }
      ),
      safe(
        async () => {
          const { getHomeRecommendationWidget } = await import(
            "@/lib/supabase/services/recommendation.service"
          );
          return getHomeRecommendationWidget();
        },
        {
          weekRecommendations: [] as Array<{
            id: string;
            title: string;
            priorityScore: number;
            ranking: number | null;
          }>,
        }
      ),
      safe(
        async () => {
          const { getHomePlanWidget } = await import(
            "@/lib/supabase/services/planner.service"
          );
          return getHomePlanWidget();
        },
        {
          pendingApproval: [] as Array<{ id: string; title: string }>,
          active: [] as Array<{ id: string; title: string }>,
          blockedSteps: [] as Array<{
            planId: string;
            planTitle: string;
            step: { id: string; title: string };
          }>,
          upcomingMilestones: [] as Array<{
            planId: string;
            milestone: { id: string; title: string };
          }>,
          withoutOwner: [] as Array<{ id: string; title: string }>,
        }
      ),
      safe(
        async () => {
          const { getHomeAutomationWidget } = await import(
            "@/lib/supabase/services/automation.service"
          );
          return getHomeAutomationWidget();
        },
        {
          awaitingConfirmation: [] as Array<{ id: string; title: string }>,
          scheduledToday: [] as Array<{ id: string; title: string }>,
          executedToday: [] as Array<{ id: string; title: string }>,
          failed: [] as Array<{ id: string; title: string }>,
          blocked: [] as Array<{ id: string; title: string }>,
        }
      ),
      safe(
        async () => {
          const { getHomeAgentWidget } = await import(
            "@/lib/supabase/services/agent-runtime.service"
          );
          return getHomeAgentWidget();
        },
        {
          active: [] as Array<{ id: string; objective: string }>,
          awaitingConfirmation: [] as Array<{ id: string; objective: string }>,
          awaitingInput: [] as Array<{ id: string; objective: string }>,
          completedToday: [] as Array<{ id: string; objective: string }>,
          failed: [] as Array<{ id: string; objective: string }>,
          upcomingReviews: [] as Array<{ id: string; objective: string }>,
        }
      ),
      safe(
        async () => {
          const { getHomeProjectsWidget } = await import(
            "@/lib/supabase/services/projects.service"
          );
          return getHomeProjectsWidget();
        },
        {
          active: [] as Array<{ id: string; name: string }>,
          recent: [] as Array<{ id: string; name: string; status: string }>,
          favorites: [] as Array<{ id: string; name: string }>,
        }
      ),
      safe(
        async () => {
          const { getAuraBrainTimeline } = await import(
            "@/lib/supabase/services/discovery-engine.service"
          );
          return getAuraBrainTimeline(20);
        },
        [] as Array<{
          id: string;
          kind: string;
          title: string;
          summary?: string;
          at: string;
          href: string;
          sourceId?: string;
        }>
      ),
      safe(
        async () => {
          const { listMemories } = await import(
            "@/lib/supabase/services/memory-engine.service"
          );
          return listMemories({ limit: 5 });
        },
        [] as Array<{ id: string; title: string }>
      ),
    ]);

    const priorities = priorityWidget.weekPriorities.map((p) =>
      hint(p.id, p.title, `/dashboard/priorities/${p.id}`, p.priorityScore)
    );
    const recommendations = recommendationWidget.weekRecommendations.map((r) =>
      hint(r.id, r.title, `/dashboard/recommendations/${r.id}`, r.priorityScore)
    );
    const activePlan =
      planWidget.active[0]
        ? hint(
            planWidget.active[0].id,
            planWidget.active[0].title,
            `/dashboard/plans/${planWidget.active[0].id}`
          )
        : focus.planId
          ? hint(focus.planId, "Plano da sessão", `/dashboard/plans/${focus.planId}`)
          : null;
    const projectPick =
      projectsWidget.active.find((p) => p.id === focus.projectId) ??
      projectsWidget.active[0] ??
      null;
    const activeProject = projectPick
      ? hint(projectPick.id, projectPick.name, `/dashboard/projects/${projectPick.id}`)
      : null;

    const activeAgents = agentWidget.active.map((a) =>
      hint(a.id, a.objective, `/dashboard/agents/${a.id}`)
    );
    const automations = [
      ...automationWidget.awaitingConfirmation,
      ...automationWidget.scheduledToday,
    ].map((a) => hint(a.id, a.title, `/dashboard/automations/${a.id}`));

    const risks = [
      ...planWidget.blockedSteps.map((s) =>
        hint(s.step.id, `${s.planTitle}: ${s.step.title}`, `/dashboard/plans/${s.planId}`, 80)
      ),
      ...automationWidget.failed.map((a) =>
        hint(a.id, a.title, `/dashboard/automations/${a.id}`, 90)
      ),
      ...agentWidget.failed.map((a) =>
        hint(a.id, a.objective, `/dashboard/agents/${a.id}`, 90)
      ),
    ];

    const opportunities = recommendations.slice(0, 5);
    const nextActions = [
      ...planWidget.pendingApproval.map((p) =>
        hint(p.id, `Aprovar: ${p.title}`, `/dashboard/plans/${p.id}`)
      ),
      ...automationWidget.awaitingConfirmation.map((a) =>
        hint(a.id, `Confirmar: ${a.title}`, `/dashboard/automations/${a.id}`)
      ),
      ...agentWidget.awaitingConfirmation.map((a) =>
        hint(a.id, `Confirmar agente: ${a.objective}`, `/dashboard/agents/${a.id}`)
      ),
    ];

    const timelineEvents: TimelineInputEvent[] = [
      ...timelineRaw.map((e) => ({
        id: e.id,
        source: mapLegacyTimelineKind(e.kind),
        title: e.title,
        summary: e.summary ?? "",
        at: e.at,
        href: e.href,
        sourceId: e.sourceId,
      })),
      ...planWidget.active.map((p) => ({
        id: `plan-${p.id}`,
        source: "plan" as const,
        title: p.title,
        summary: "Plano ativo",
        at: new Date().toISOString(),
        href: `/dashboard/plans/${p.id}`,
        sourceId: p.id,
      })),
      ...agentWidget.active.map((a) => ({
        id: `agent-${a.id}`,
        source: "agent" as const,
        title: a.objective,
        summary: "Agente ativo",
        at: new Date().toISOString(),
        href: `/dashboard/agents/${a.id}`,
        sourceId: a.id,
      })),
      ...memories.map((m) => ({
        id: `mem-${m.id}`,
        source: "memory" as const,
        title: m.title,
        summary: "Memória recente",
        at: new Date().toISOString(),
        href: "/dashboard/settings/memory",
        sourceId: m.id,
      })),
    ];

    return buildAuraHome({
      slice: {
        user: hint(ctx.userId, "Você", "/dashboard/settings/identity"),
        workspace: ctx.activeWorkspaceId
          ? hint(ctx.activeWorkspaceId, "Workspace ativo", "/dashboard")
          : hint("personal", "Pessoal", "/dashboard"),
        activeProject,
        activePlan,
        activeMission: focus.missionId
          ? hint(focus.missionId, "Missão da sessão", `/dashboard/missions`)
          : null,
        activeBusiness: focus.businessId
          ? hint(focus.businessId, "Empresa da sessão", "/dashboard/business")
          : null,
        priorities,
        activeAgents,
        automations,
        risks,
        opportunities,
        recommendations,
        discoveries: [],
        nextActions,
      },
      session: focus,
      personality,
      timelineEvents,
      correlationId: `home_${ctx.userId}_${Date.now()}`,
    });
  });
}

export async function getOrchestratorGlobalContext(): Promise<GlobalContext> {
  const home = await loadOrchestratorHome();
  return home.context;
}

export async function updateSessionFocusActionPayload(
  patch: Partial<SessionFocus>
): Promise<{ focus: SessionFocus; error: string | null }> {
  const ctx = await getDataContext();
  const { setSessionFocus } = await import("@/lib/orchestrator/session");
  const next = setSessionFocus(ctx.userId, patch);
  clearOrchestratorCache();
  return { focus: next.focus, error: null };
}

export async function updatePersonalityPayload(
  patch: Partial<AuraPersonality>
): Promise<{ personality: AuraPersonality; error: string | null }> {
  const ctx = await getDataContext();
  const { setPersonality } = await import("@/lib/orchestrator/session");
  const { normalizePersonality } = await import("@/lib/orchestrator/personality");
  const next = setPersonality(ctx.userId, normalizePersonality(patch));
  clearOrchestratorCache();
  return { personality: next.personality, error: null };
}
