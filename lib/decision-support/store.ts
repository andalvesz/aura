/**
 * Decision Support store — in-memory (Sprint 7.0).
 */

import {
  createEmptyDecisionState,
  type DecisionState,
} from "@/lib/decision-support/types/types";

const states = new Map<string, DecisionState>();

export function decisionStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getDecisionState(key: string): DecisionState {
  return states.get(key) ?? createEmptyDecisionState();
}

export function setDecisionState(key: string, state: DecisionState): void {
  states.set(key, state);
}

export function clearDecisionState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
