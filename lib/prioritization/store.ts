/**
 * Prioritization store — in-memory (Sprint 7.2).
 */

import {
  createEmptyPriorityState,
  type PriorityState,
} from "@/lib/prioritization/types/types";

const states = new Map<string, PriorityState>();

export function priorityStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getPriorityState(key: string): PriorityState {
  return states.get(key) ?? createEmptyPriorityState();
}

export function setPriorityState(key: string, state: PriorityState): void {
  states.set(key, state);
}

export function clearPriorityState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
