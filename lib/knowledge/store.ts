/**
 * In-memory Knowledge Hub store (RC4.1).
 */

import {
  createEmptyKnowledgeState,
  type KnowledgeState,
} from "@/lib/knowledge/types";

const states = new Map<string, KnowledgeState>();

export function knowledgeStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getKnowledgeState(key: string): KnowledgeState {
  return states.get(key) ?? createEmptyKnowledgeState();
}

export function setKnowledgeState(key: string, state: KnowledgeState): void {
  states.set(key, state);
}

export function clearKnowledgeState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
