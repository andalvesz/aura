/**
 * Session Context — workspace / project / mission / business / plan focus.
 * In-memory coordination; does not invent a second Brain.
 */

import {
  DEFAULT_AURA_PERSONALITY,
  EMPTY_SESSION_FOCUS,
  type AuraPersonality,
  type SessionFocus,
} from "@/lib/orchestrator/types";

export type OrchestratorSessionState = {
  userId: string;
  focus: SessionFocus;
  personality: AuraPersonality;
  updatedAt: string;
};

const sessions = new Map<string, OrchestratorSessionState>();

export function clearOrchestratorSessions(): void {
  sessions.clear();
}

export function getOrchestratorSession(
  userId: string
): OrchestratorSessionState {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const fresh: OrchestratorSessionState = {
    userId,
    focus: { ...EMPTY_SESSION_FOCUS },
    personality: { ...DEFAULT_AURA_PERSONALITY, objectives: [], preferences: [] },
    updatedAt: new Date().toISOString(),
  };
  sessions.set(userId, fresh);
  return fresh;
}

export function setSessionFocus(
  userId: string,
  patch: Partial<SessionFocus>
): OrchestratorSessionState {
  const current = getOrchestratorSession(userId);
  const next: OrchestratorSessionState = {
    ...current,
    focus: { ...current.focus, ...patch },
    updatedAt: new Date().toISOString(),
  };
  sessions.set(userId, next);
  return next;
}

export function switchWorkspaceContext(
  userId: string,
  input: {
    contextMode: "personal" | "workspace";
    workspaceId: string | null;
    /** When true, clear project/mission/plan/business focus (default). */
    resetFocus?: boolean;
  }
): OrchestratorSessionState {
  const reset = input.resetFocus !== false;
  return setSessionFocus(userId, {
    contextMode: input.contextMode,
    workspaceId: input.contextMode === "personal" ? null : input.workspaceId,
    ...(reset
      ? {
          projectId: null,
          missionId: null,
          businessId: null,
          planId: null,
        }
      : {}),
  });
}

export function setActiveProject(
  userId: string,
  projectId: string | null
): OrchestratorSessionState {
  return setSessionFocus(userId, { projectId });
}

export function setActiveMission(
  userId: string,
  missionId: string | null
): OrchestratorSessionState {
  return setSessionFocus(userId, { missionId });
}

export function setActivePlan(
  userId: string,
  planId: string | null
): OrchestratorSessionState {
  return setSessionFocus(userId, { planId });
}

export function setActiveBusiness(
  userId: string,
  businessId: string | null
): OrchestratorSessionState {
  return setSessionFocus(userId, { businessId });
}

export function setPersonality(
  userId: string,
  patch: Partial<AuraPersonality>
): OrchestratorSessionState {
  const current = getOrchestratorSession(userId);
  const next: OrchestratorSessionState = {
    ...current,
    personality: {
      ...current.personality,
      ...patch,
      objectives: patch.objectives ?? current.personality.objectives,
      preferences: patch.preferences ?? current.personality.preferences,
    },
    updatedAt: new Date().toISOString(),
  };
  sessions.set(userId, next);
  return next;
}
