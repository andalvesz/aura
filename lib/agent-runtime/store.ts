import {
  createEmptyAgentState,
  type AgentState,
} from "@/lib/agent-runtime/types";

const states = new Map<string, AgentState>();

export function agentStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getAgentState(key: string): AgentState {
  return states.get(key) ?? createEmptyAgentState();
}

export function setAgentState(key: string, state: AgentState): void {
  states.set(key, state);
}

export function clearAgentState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}

export function cloneAgentState(state: AgentState): AgentState {
  return {
    sessions: state.sessions.map((s) => ({
      ...s,
      contextSnapshot: s.contextSnapshot
        ? { ...s.contextSnapshot }
        : null,
      checkpoint: s.checkpoint ? { ...s.checkpoint } : null,
      result: s.result ? { ...s.result } : null,
    })),
    steps: state.steps.map((s) => ({ ...s })),
    confirmations: state.confirmations.map((c) => ({ ...c })),
    audits: state.audits.map((a) => ({ ...a })),
    notifications: state.notifications.map((n) => ({ ...n })),
    settings: {
      pauseAllAgents: state.settings.pauseAllAgents,
      allowAutoSafe: state.settings.allowAutoSafe,
      perAgent: { ...state.settings.perAgent },
    },
    dailyCounts: { ...state.dailyCounts },
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function hashPayload(input: Record<string, unknown>): string {
  const raw = JSON.stringify(sortKeys(input));
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sortKeys(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

export function nowIso(n = Date.now()): string {
  return new Date(n).toISOString();
}
