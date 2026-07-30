/**
 * In-memory Daily Ops store (RC3) — per user, with optional workspace key.
 */

import {
  createEmptyDailyOpsState,
  type DailyOpsState,
} from "@/lib/daily/types";

const states = new Map<string, DailyOpsState>();

export function dailyOpsKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getDailyOpsState(key: string): DailyOpsState {
  return states.get(key) ?? createEmptyDailyOpsState();
}

export function setDailyOpsState(key: string, state: DailyOpsState): void {
  states.set(key, state);
}

export function clearDailyOpsState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
