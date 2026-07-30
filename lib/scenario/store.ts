/**
 * Scenario store — in-memory (Sprint 7.1).
 */

import {
  createEmptyScenarioState,
  type ScenarioState,
} from "@/lib/scenario/types/types";

const states = new Map<string, ScenarioState>();

export function scenarioStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getScenarioState(key: string): ScenarioState {
  return states.get(key) ?? createEmptyScenarioState();
}

export function setScenarioState(key: string, state: ScenarioState): void {
  states.set(key, state);
}

export function clearScenarioState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
