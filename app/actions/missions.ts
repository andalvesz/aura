"use server";

import { revalidatePath } from "next/cache";
import type {
  MissionCreateInput,
  MissionStatus,
  MissionTaskStatus,
  MissionType,
} from "@/lib/missions/mission-types";
import {
  completeMissionTaskAction,
  createMissionAction,
  updateMissionStatusAction,
  updateMissionTaskStatusAction,
} from "@/lib/supabase/services/mission.service";

function revalidateMissions(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/missions");
  revalidatePath("/missions");
}

export async function createMission(
  input: MissionCreateInput
): Promise<{ error: string | null; missionId?: string }> {
  const allowed: MissionType[] = [
    "PERSONAL",
    "BUSINESS",
    "LEARNING",
    "HEALTH",
    "FINANCIAL",
    "TRAVEL",
    "CUSTOM",
  ];
  if (!input.title?.trim()) return { error: "Título obrigatório" };
  if (!allowed.includes(input.type)) return { error: "Tipo inválido" };

  const result = await createMissionAction(input);
  revalidateMissions();
  return {
    error: result.error,
    missionId: result.mission?.id,
  };
}

export async function completeMissionTask(
  missionId: string,
  taskId: string
): Promise<{ error: string | null }> {
  if (!missionId || !taskId) return { error: "Parâmetros inválidos" };
  const result = await completeMissionTaskAction(missionId, taskId);
  revalidateMissions();
  return { error: result.error };
}

export async function updateMissionStatus(
  missionId: string,
  status: MissionStatus
): Promise<{ error: string | null }> {
  const allowed: MissionStatus[] = [
    "PLANNING",
    "ACTIVE",
    "PAUSED",
    "BLOCKED",
    "COMPLETED",
    "ARCHIVED",
  ];
  if (!missionId || !allowed.includes(status)) return { error: "Parâmetros inválidos" };
  const result = await updateMissionStatusAction(missionId, status);
  revalidateMissions();
  return { error: result.error };
}

export async function updateMissionTaskStatus(
  missionId: string,
  taskId: string,
  status: MissionTaskStatus
): Promise<{ error: string | null }> {
  const allowed: MissionTaskStatus[] = [
    "pending",
    "in_progress",
    "blocked",
    "done",
    "cancelled",
  ];
  if (!missionId || !taskId || !allowed.includes(status)) {
    return { error: "Parâmetros inválidos" };
  }
  const result = await updateMissionTaskStatusAction(missionId, taskId, status);
  revalidateMissions();
  return { error: result.error };
}
