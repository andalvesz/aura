/**
 * Agent Runtime service facade (Sprint 8.2).
 */

import {
  agentStoreKey,
  answerAgentInputPure,
  cancelAgentSessionPure,
  clearAgentRegistry,
  confirmAgentStepPure,
  createAgentSessionPure,
  enableAgentPure,
  ensureBuiltinAgents,
  explainAgentSessionPure,
  getAgentSessionPure,
  getAgentState,
  getHomeAgentWidgetPure,
  listAgentDefinitions,
  listAgentSessionsPure,
  listSessionStepsPure,
  pauseAgentSessionPure,
  runAgentSessionPure,
  setAgentState,
  type AgentId,
  type AgentSession,
  type AgentSettings,
  type RunAgentSessionInput,
} from "@/lib/agent-runtime";
import { getAuraBrainSettings } from "@/lib/aura-brain/context";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxBundle() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = agentStoreKey(ctx.userId, ws);
  ensureBuiltinAgents();
  return {
    ctx,
    ws,
    key,
    settings: getAuraBrainSettings(ctx.userId),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      role: null as string | null,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

export async function listAvailableAgents() {
  ensureBuiltinAgents();
  const { key } = await ctxBundle();
  const state = getAgentState(key);
  return listAgentDefinitions().map((a) => ({
    ...a,
    enabled: state.settings.perAgent[a.id]?.enabled === true,
    settings: state.settings.perAgent[a.id] ?? null,
  }));
}

export async function enableAgent(
  agentId: AgentId,
  partial?: Partial<AgentSettings>
) {
  const { key } = await ctxBundle();
  const next = enableAgentPure(getAgentState(key), agentId, partial);
  setAgentState(key, next);
  return { ok: true, error: null };
}

export async function updateAgentRuntimeSettings(partial: {
  pauseAllAgents?: boolean;
  allowAutoSafe?: boolean;
}) {
  const { key } = await ctxBundle();
  const state = getAgentState(key);
  state.settings = { ...state.settings, ...partial };
  setAgentState(key, state);
  return { settings: state.settings, error: null };
}

export async function createAgentSession(input: RunAgentSessionInput) {
  const { key, viewer, settings } = await ctxBundle();
  const res = createAgentSessionPure(
    getAgentState(key),
    viewer,
    input,
    settings
  );
  setAgentState(key, res.state);
  return { session: res.data, error: res.error };
}

export async function runAgentSession(
  sessionId: string,
  opts?: { confirmed?: boolean; confirmationToken?: string }
) {
  const { key, viewer, settings } = await ctxBundle();
  const res = await runAgentSessionPure(
    getAgentState(key),
    viewer,
    sessionId,
    settings,
    opts
  );
  setAgentState(key, res.state);
  return { session: res.data, error: res.error };
}

export async function confirmAgentStep(
  sessionId: string,
  confirmationToken: string
) {
  const { key, viewer, settings } = await ctxBundle();
  let state = getAgentState(key);
  const confirmed = confirmAgentStepPure(
    state,
    viewer,
    sessionId,
    confirmationToken
  );
  if (!confirmed.ok) {
    return { session: confirmed.data, error: confirmed.error };
  }
  setAgentState(key, confirmed.state);
  const ran = await runAgentSessionPure(
    confirmed.state,
    viewer,
    sessionId,
    settings,
    { confirmed: true, confirmationToken }
  );
  setAgentState(key, ran.state);
  return { session: ran.data, error: ran.error };
}

export async function answerAgentInput(sessionId: string, answer: string) {
  const { key, viewer, settings } = await ctxBundle();
  const answered = answerAgentInputPure(
    getAgentState(key),
    viewer,
    sessionId,
    answer
  );
  if (!answered.ok) {
    return { session: answered.data, error: answered.error };
  }
  setAgentState(key, answered.state);
  const ran = await runAgentSessionPure(
    answered.state,
    viewer,
    sessionId,
    settings
  );
  setAgentState(key, ran.state);
  return { session: ran.data, error: ran.error };
}

export async function pauseAgentSession(sessionId: string) {
  const { key, viewer } = await ctxBundle();
  const res = pauseAgentSessionPure(getAgentState(key), viewer, sessionId);
  setAgentState(key, res.state);
  return { session: res.data, error: res.error };
}

export async function cancelAgentSession(sessionId: string) {
  const { key, viewer } = await ctxBundle();
  const res = cancelAgentSessionPure(getAgentState(key), viewer, sessionId);
  setAgentState(key, res.state);
  return { session: res.data, error: res.error };
}

export async function listAgentSessions(opts?: {
  status?: string | string[];
  agentId?: string;
  limit?: number;
}) {
  const { key, viewer } = await ctxBundle();
  return {
    items: listAgentSessionsPure(getAgentState(key), viewer, opts),
    error: null as string | null,
  };
}

export async function getAgentSession(id: string) {
  const { key, viewer } = await ctxBundle();
  const state = getAgentState(key);
  const session = getAgentSessionPure(state, viewer, id);
  return {
    session,
    steps: session ? listSessionStepsPure(state, id) : [],
    audits: state.audits.filter((a) => a.sessionId === id).slice(0, 50),
    error: session ? null : "not_found",
  };
}

export async function explainAgentSession(id: string) {
  const { key, viewer } = await ctxBundle();
  const explanation = explainAgentSessionPure(
    getAgentState(key),
    viewer,
    id
  );
  return { explanation, error: explanation ? null : "not_found" };
}

export async function getHomeAgentWidget() {
  const { key, viewer } = await ctxBundle();
  return getHomeAgentWidgetPure(getAgentState(key), viewer);
}

export async function createSessionFromPlan(input: {
  planId: string;
  planStatus: string;
  planTitle: string;
  agentId: AgentId;
  projectId?: string | null;
  steps?: Array<{
    id: string;
    title: string;
    status: string;
    stepType?: string;
    description?: string;
  }>;
  planRowVersion?: number;
}) {
  return createAgentSession({
    agentId: input.agentId,
    objective: `Executar plano: ${input.planTitle}`,
    sourceType: "plan",
    sourceId: input.planId,
    planId: input.planId,
    planStatus: input.planStatus,
    planRowVersion: input.planRowVersion,
    projectId: input.projectId,
    context: {
      plans: [
        {
          id: input.planId,
          title: input.planTitle,
          status: input.planStatus,
          steps: input.steps ?? [],
          rowVersion: input.planRowVersion,
        },
      ],
    },
  });
}

export type { AgentSession };
export { clearAgentRegistry };
