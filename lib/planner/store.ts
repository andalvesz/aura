import {
  createEmptyPlanState,
  type PlanState,
} from "@/lib/planner/types/types";

const states = new Map<string, PlanState>();

export function planStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getPlanState(key: string): PlanState {
  return states.get(key) ?? createEmptyPlanState();
}

export function setPlanState(key: string, state: PlanState): void {
  states.set(key, state);
}

export function clearPlanState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
