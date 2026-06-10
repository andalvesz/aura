import type { AgentHistory, Json } from "@/types/database";
import type { AuraAgentId } from "@/utils/agent-registry";
import { AgentHistoryRepository } from "@/lib/supabase/repositories/agent-history.repository";
import { getOptionalDataContext } from "./context";

export async function logAgentHistory(params: {
  agentId: AuraAgentId | "brain";
  userMessage: string;
  agentResponse: string;
  consultedAgents: AuraAgentId[];
  metadata?: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new AgentHistoryRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.create({
    agent_id: params.agentId,
    user_message: params.userMessage,
    agent_response: params.agentResponse,
    consulted_agents: params.consultedAgents as Json,
    metadata: (params.metadata ?? {}) as Json,
  });

  return { error };
}

export async function listAgentHistory(limit = 15): Promise<{
  entries: AgentHistory[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { entries: [], error: "Usuário não autenticado." };

  const repo = new AgentHistoryRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(limit);

  if (error) return { entries: [], error };
  return { entries: data ?? [], error: null };
}
