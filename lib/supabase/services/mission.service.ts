/**
 * Server service — Mission Engine facade.
 * Application code should consume only getMissionEngine().
 */

import { runMissionEngine } from "@/lib/missions/mission-engine";
import { enrichMission } from "@/lib/missions/mission-progress";
import {
  clearStoredMissions,
  listStoredMissions,
  replaceStoredMissions,
  updateStoredTaskStatus,
  upsertStoredMission,
} from "@/lib/missions/mission-store";
import type {
  Mission,
  MissionCreateInput,
  MissionEngineResult,
  MissionStatus,
  MissionTaskStatus,
  MissionType,
} from "@/lib/missions/mission-types";
import type { AuraIntelligenceResult } from "@/lib/intelligence/types";
import { getDataContext } from "@/lib/supabase/services/context";

type LooseClient = {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        order: (
          col: string,
          opts?: { ascending?: boolean }
        ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown> | Record<string, unknown>[],
      opts?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

function loose(supabase: unknown): LooseClient {
  return supabase as LooseClient;
}

function rowToMission(row: Record<string, unknown>, userId: string): Mission | null {
  const payload = row.payload as Mission | undefined;
  if (payload && payload.id && payload.title) {
    return {
      ...payload,
      userId: payload.userId || userId,
    };
  }
  return null;
}

async function loadMissionsFromDb(
  supabase: unknown,
  userId: string
): Promise<Mission[]> {
  try {
    const { data, error } = await loose(supabase)
      .from("aura_missions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((row) => rowToMission(row, userId))
      .filter((m): m is Mission => Boolean(m));
  } catch {
    return [];
  }
}

async function persistMission(
  supabase: unknown,
  mission: Mission
): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_missions")
      .upsert(
        {
          id: mission.id,
          user_id: mission.userId,
          workspace_id: mission.workspaceId,
          title: mission.title,
          description: mission.description,
          type: mission.type,
          status: mission.status,
          priority: mission.priority,
          start_date: mission.startDate,
          target_date: mission.targetDate,
          progress_pct: mission.progress.totalPct,
          score: mission.score,
          modules: mission.modules,
          payload: mission,
          last_activity_at: mission.lastActivityAt,
          updated_at: mission.updatedAt,
          created_at: mission.createdAt,
        },
        { onConflict: "id" }
      );
  } catch {
    // best-effort — table may not exist yet
  }
}

export async function getMissionEngine(options?: {
  create?: MissionCreateInput[];
  intelligence?: AuraIntelligenceResult;
  skipDb?: boolean;
  /** Inject missions for tests */
  missions?: Mission[];
}): Promise<MissionEngineResult> {
  const ctx = await getDataContext();
  const mode = ctx.activeContext === "workspace" ? "workspace" : "personal";

  let existing =
    options?.missions ??
    listStoredMissions(ctx.userId);

  if (!options?.missions && !options?.skipDb && existing.length === 0) {
    const fromDb = await loadMissionsFromDb(ctx.supabase, ctx.userId);
    if (fromDb.length > 0) {
      replaceStoredMissions(ctx.userId, fromDb);
      existing = fromDb;
    }
  }

  const result = runMissionEngine({
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    mode,
    missions: existing,
    create: options?.create,
    intelligence: options?.intelligence
      ? {
          priorities: options.intelligence.priorities,
          alerts: options.intelligence.alerts,
          score: options.intelligence.score,
        }
      : undefined,
  });

  replaceStoredMissions(ctx.userId, result.missions);

  if (!options?.skipDb) {
    const createdIds = new Set(
      options?.create
        ? result.missions
            .slice(-result.meta.createdCount)
            .map((m) => m.id)
        : []
    );
    for (const m of result.missions) {
      if (createdIds.has(m.id) || options?.create?.length) {
        await persistMission(ctx.supabase, m);
      }
    }
    // Always persist snapshot of active set (best-effort)
    if (result.meta.createdCount > 0) {
      for (const m of result.missions.slice(-result.meta.createdCount)) {
        await persistMission(ctx.supabase, m);
      }
    }
  }

  return result;
}

export async function createMissionAction(
  input: MissionCreateInput
): Promise<{ mission: Mission | null; error: string | null }> {
  try {
    if (!input.title?.trim()) {
      return { mission: null, error: "Título obrigatório" };
    }
    const allowed: MissionType[] = [
      "PERSONAL",
      "BUSINESS",
      "LEARNING",
      "HEALTH",
      "FINANCIAL",
      "TRAVEL",
      "CUSTOM",
    ];
    if (!allowed.includes(input.type)) {
      return { mission: null, error: "Tipo inválido" };
    }
    const engine = await getMissionEngine({ create: [input] });
    const mission = engine.missions[engine.missions.length - 1] ?? null;
    return { mission, error: null };
  } catch (e) {
    return {
      mission: null,
      error: e instanceof Error ? e.message : "Falha ao criar missão",
    };
  }
}

export async function completeMissionTaskAction(
  missionId: string,
  taskId: string
): Promise<{ mission: Mission | null; error: string | null }> {
  try {
    const ctx = await getDataContext();
    const updated = updateStoredTaskStatus(
      ctx.userId,
      missionId,
      taskId,
      "done"
    );
    if (!updated) return { mission: null, error: "Missão ou tarefa não encontrada" };
    const enriched = enrichMission(updated);
    upsertStoredMission(ctx.userId, enriched);
    await persistMission(ctx.supabase, enriched);
    return { mission: enriched, error: null };
  } catch (e) {
    return {
      mission: null,
      error: e instanceof Error ? e.message : "Falha ao atualizar tarefa",
    };
  }
}

export async function updateMissionStatusAction(
  missionId: string,
  status: MissionStatus
): Promise<{ mission: Mission | null; error: string | null }> {
  try {
    const ctx = await getDataContext();
    const list = listStoredMissions(ctx.userId);
    const mission = list.find((m) => m.id === missionId);
    if (!mission) return { mission: null, error: "Missão não encontrada" };
    const now = new Date().toISOString();
    const next = enrichMission({
      ...mission,
      status,
      updatedAt: now,
      lastActivityAt: now,
    });
    upsertStoredMission(ctx.userId, next);
    await persistMission(ctx.supabase, next);
    return { mission: next, error: null };
  } catch (e) {
    return {
      mission: null,
      error: e instanceof Error ? e.message : "Falha ao atualizar status",
    };
  }
}

export async function updateMissionTaskStatusAction(
  missionId: string,
  taskId: string,
  status: MissionTaskStatus
): Promise<{ mission: Mission | null; error: string | null }> {
  try {
    const ctx = await getDataContext();
    const updated = updateStoredTaskStatus(ctx.userId, missionId, taskId, status);
    if (!updated) return { mission: null, error: "Missão ou tarefa não encontrada" };
    const enriched = enrichMission(updated);
    upsertStoredMission(ctx.userId, enriched);
    await persistMission(ctx.supabase, enriched);
    return { mission: enriched, error: null };
  } catch (e) {
    return {
      mission: null,
      error: e instanceof Error ? e.message : "Falha ao atualizar tarefa",
    };
  }
}

/** Test helper */
export function resetMissionServiceStore(userId?: string): void {
  clearStoredMissions(userId);
}
