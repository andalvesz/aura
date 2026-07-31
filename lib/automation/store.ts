import {
  createEmptyAutomationState,
  type AutomationState,
} from "@/lib/automation/types/types";

const states = new Map<string, AutomationState>();

export function automationStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getAutomationState(key: string): AutomationState {
  return states.get(key) ?? createEmptyAutomationState();
}

export function setAutomationState(key: string, state: AutomationState): void {
  states.set(key, state);
}

export function clearAutomationState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}

export function cloneAutomationState(state: AutomationState): AutomationState {
  return {
    automations: state.automations.map((a) => ({ ...a })),
    attempts: state.attempts.map((a) => ({ ...a })),
    confirmations: state.confirmations.map((c) => ({ ...c })),
    audits: state.audits.map((a) => ({ ...a })),
    notifications: state.notifications.map((n) => ({ ...n })),
    idempotencyIndex: { ...state.idempotencyIndex },
    cooldownIndex: { ...state.cooldownIndex },
    dailyCounts: { ...state.dailyCounts },
  };
}
