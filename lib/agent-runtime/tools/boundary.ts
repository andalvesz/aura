/**
 * Tool boundary — Action Registry wrappers only.
 * Never expose supabase, shell, fs, env, SQL, or unrestricted fetch.
 */

import {
  ensureBuiltinActions,
  getAction,
  isBlockedActionId,
  sanitizeActionInput,
} from "@/lib/aura-brain/actions/registry";
import type { AgentTool } from "@/lib/agent-runtime/types";
import { isActionAllowedForAgent, getAgentDefinition } from "@/lib/agent-runtime/registry";
import type { AgentDefinition } from "@/lib/agent-runtime/types";

const toolCache = new Map<string, AgentTool>();

function buildTool(actionId: string): AgentTool | null {
  ensureBuiltinActions();
  if (isBlockedActionId(actionId)) return null;
  const def = getAction(actionId);
  if (!def) return null;
  return {
    actionId: def.id,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
    riskLevel: def.riskLevel,
    timeoutMs: def.timeoutMs,
    idempotencyRequired: true,
    requiresConfirmation: def.requiresConfirmation,
    sanitizeForAudit: (input) =>
      def.sanitizeForAudit?.(input) ?? sanitizeActionInput(actionId, input),
  };
}

export function getAgentTool(actionId: string): AgentTool | null {
  if (toolCache.has(actionId)) return toolCache.get(actionId)!;
  const tool = buildTool(actionId);
  if (tool) toolCache.set(actionId, tool);
  return tool;
}

export function resolveAgentTool(
  agent: AgentDefinition,
  actionId: string
): { ok: true; tool: AgentTool } | { ok: false; reason: string } {
  if (!isActionAllowedForAgent(agent, actionId)) {
    return { ok: false, reason: "action_not_in_agent_allowlist" };
  }
  const tool = getAgentTool(actionId);
  if (!tool) return { ok: false, reason: "tool_not_registered" };
  return { ok: true, tool };
}

export async function invokeAgentTool(params: {
  agentId: string;
  actionId: string;
  userId: string;
  workspaceId: string | null;
  context: "personal" | "workspace";
  input: Record<string, unknown>;
  confirmed: boolean;
}): Promise<{
  ok: boolean;
  output: Record<string, unknown>;
  error: string | null;
  undoToken: string | null;
  sanitizedInput: Record<string, unknown>;
}> {
  const agent = getAgentDefinition(params.agentId);
  if (!agent) {
    return {
      ok: false,
      output: {},
      error: "agent_not_registered",
      undoToken: null,
      sanitizedInput: {},
    };
  }
  const resolved = resolveAgentTool(agent, params.actionId);
  if (!resolved.ok) {
    return {
      ok: false,
      output: {},
      error: resolved.reason,
      undoToken: null,
      sanitizedInput: {},
    };
  }

  ensureBuiltinActions();
  const def = getAction(params.actionId);
  if (!def) {
    return {
      ok: false,
      output: {},
      error: "action_not_registered",
      undoToken: null,
      sanitizedInput: {},
    };
  }

  const sanitizedInput = resolved.tool.sanitizeForAudit(params.input);
  const validation = def.validate(params.input);
  if (!validation.ok) {
    return {
      ok: false,
      output: {},
      error: validation.error,
      undoToken: null,
      sanitizedInput,
    };
  }

  if (def.prepare) {
    const prep = await def.prepare(params.input);
    if (!prep.ok) {
      return {
        ok: false,
        output: prep.output,
        error: prep.error,
        undoToken: null,
        sanitizedInput,
      };
    }
  }

  try {
    const result = await def.execute({
      userId: params.userId,
      workspaceId: params.workspaceId,
      context: params.context,
      input: params.input,
      confirmed: params.confirmed,
    });
    return {
      ok: result.ok,
      output: result.output,
      error: result.error,
      undoToken: result.undoToken ?? null,
      sanitizedInput,
    };
  } catch (e) {
    return {
      ok: false,
      output: {},
      error: e instanceof Error ? e.message : "tool_execution_error",
      undoToken: null,
      sanitizedInput,
    };
  }
}

/** Explicit denylist — client cannot inject arbitrary tools */
export function rejectClientProvidedTools(
  tools: unknown
): { ok: boolean; reason: string | null } {
  if (tools == null) return { ok: true, reason: null };
  if (Array.isArray(tools) && tools.length > 0) {
    return { ok: false, reason: "client_tools_forbidden" };
  }
  if (typeof tools === "object" && Object.keys(tools as object).length > 0) {
    return { ok: false, reason: "client_tools_forbidden" };
  }
  return { ok: true, reason: null };
}
