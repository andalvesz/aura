/**
 * Recommendation store — in-memory (Sprint 7.3).
 */

import {
  createEmptyRecommendationState,
  type RecommendationState,
} from "@/lib/recommendation/types/types";

const states = new Map<string, RecommendationState>();

export function recommendationStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getRecommendationState(key: string): RecommendationState {
  return states.get(key) ?? createEmptyRecommendationState();
}

export function setRecommendationState(
  key: string,
  state: RecommendationState
): void {
  states.set(key, state);
}

export function clearRecommendationState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
