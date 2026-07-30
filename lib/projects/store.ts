/**
 * In-memory Projects & Business store (RC4).
 */

import {
  createEmptyProjectsState,
  type ProjectsState,
} from "@/lib/projects/types";

const states = new Map<string, ProjectsState>();

export function projectsStoreKey(
  userId: string,
  workspaceId?: string | null
): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

export function getProjectsState(key: string): ProjectsState {
  return states.get(key) ?? createEmptyProjectsState();
}

export function setProjectsState(key: string, state: ProjectsState): void {
  states.set(key, state);
}

export function clearProjectsState(key?: string): void {
  if (key) states.delete(key);
  else states.clear();
}
