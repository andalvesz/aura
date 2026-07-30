/**
 * In-memory mission store — mirrors Aura Brain settings pattern.
 * Best-effort Supabase persist happens in the service layer.
 */

import type { Mission } from "@/lib/missions/mission-types";

const byUser = new Map<string, Mission[]>();

export function listStoredMissions(userId: string): Mission[] {
  return (byUser.get(userId) ?? []).map((m) => structuredClone(m));
}

export function replaceStoredMissions(userId: string, missions: Mission[]): void {
  byUser.set(
    userId,
    missions.map((m) => structuredClone(m))
  );
}

export function upsertStoredMission(userId: string, mission: Mission): void {
  const list = byUser.get(userId) ?? [];
  const idx = list.findIndex((m) => m.id === mission.id);
  if (idx >= 0) list[idx] = structuredClone(mission);
  else list.push(structuredClone(mission));
  byUser.set(userId, list);
}

export function getStoredMission(
  userId: string,
  missionId: string
): Mission | null {
  return structuredClone(
    (byUser.get(userId) ?? []).find((m) => m.id === missionId) ?? null
  );
}

export function clearStoredMissions(userId?: string): void {
  if (userId) byUser.delete(userId);
  else byUser.clear();
}

export function updateStoredTaskStatus(
  userId: string,
  missionId: string,
  taskId: string,
  status: Mission["tasks"][number]["status"]
): Mission | null {
  const mission = getStoredMission(userId, missionId);
  if (!mission) return null;
  const now = new Date().toISOString();
  mission.tasks = mission.tasks.map((t) =>
    t.id === taskId ? { ...t, status } : t
  );
  if (status === "done") {
    const task = mission.tasks.find((t) => t.id === taskId);
    if (task?.milestoneId) {
      const siblingOpen = mission.tasks.some(
        (t) =>
          t.milestoneId === task.milestoneId &&
          t.id !== taskId &&
          t.status !== "done" &&
          t.status !== "cancelled"
      );
      if (!siblingOpen) {
        mission.milestones = mission.milestones.map((m) =>
          m.id === task.milestoneId
            ? { ...m, completed: true, completedAt: now }
            : m
        );
      }
    }
  }
  mission.updatedAt = now;
  mission.lastActivityAt = now;
  upsertStoredMission(userId, mission);
  return mission;
}
