"use server";

import { revalidatePath } from "next/cache";
import {
  answerAgentInput,
  cancelAgentSession,
  confirmAgentStep,
  createAgentSession,
  createSessionFromPlan,
  enableAgent,
  explainAgentSession,
  getAgentSession,
  listAgentSessions,
  listAvailableAgents,
  pauseAgentSession,
  runAgentSession,
  updateAgentRuntimeSettings,
} from "@/lib/supabase/services/agent-runtime.service";
import type {
  AgentId,
  RunAgentSessionInput,
} from "@/lib/agent-runtime/types";
import type { AutonomyLevel } from "@/lib/aura-brain/types";

function revalidateAgents(id?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard/settings/aura-brain");
  if (id) revalidatePath(`/dashboard/agents/${id}`);
}

export async function listAgentsAction() {
  return listAvailableAgents();
}

export async function enableAgentAction(
  agentId: AgentId,
  partial?: {
    maxAutonomyLevel?: AutonomyLevel;
    requireConfirmation?: boolean;
    stepLimit?: number;
    actionLimit?: number;
  }
) {
  const res = await enableAgent(agentId, partial);
  revalidateAgents();
  return res;
}

export async function updateAgentRuntimeSettingsAction(partial: {
  pauseAllAgents?: boolean;
  allowAutoSafe?: boolean;
}) {
  const res = await updateAgentRuntimeSettings(partial);
  revalidateAgents();
  return res;
}

export async function createAgentSessionAction(input: RunAgentSessionInput) {
  const res = await createAgentSession(input);
  revalidateAgents(res.session?.id);
  return res;
}

export async function runAgentSessionAction(sessionId: string) {
  const res = await runAgentSession(sessionId);
  revalidateAgents(sessionId);
  return res;
}

export async function confirmAgentStepAction(
  sessionId: string,
  confirmationToken: string
) {
  const res = await confirmAgentStep(sessionId, confirmationToken);
  revalidateAgents(sessionId);
  return res;
}

export async function answerAgentInputAction(
  sessionId: string,
  answer: string
) {
  const res = await answerAgentInput(sessionId, answer);
  revalidateAgents(sessionId);
  return res;
}

export async function pauseAgentSessionAction(sessionId: string) {
  const res = await pauseAgentSession(sessionId);
  revalidateAgents(sessionId);
  return res;
}

export async function cancelAgentSessionAction(sessionId: string) {
  const res = await cancelAgentSession(sessionId);
  revalidateAgents(sessionId);
  return res;
}

export async function listAgentSessionsAction(opts?: {
  status?: string | string[];
  agentId?: string;
}) {
  return listAgentSessions(opts);
}

export async function getAgentSessionAction(id: string) {
  return getAgentSession(id);
}

export async function explainAgentSessionAction(id: string) {
  return explainAgentSession(id);
}

export async function createSessionFromPlanAction(input: {
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
  const res = await createSessionFromPlan(input);
  revalidateAgents(res.session?.id);
  revalidatePath(`/dashboard/plans/${input.planId}`);
  return res;
}
