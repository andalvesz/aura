"use server";

import { revalidatePath } from "next/cache";
import { invalidateAuraIntelligenceCache } from "@/lib/intelligence";
import { getDataContext } from "@/lib/supabase/services/context";
import { updateGoal } from "@/lib/supabase/services/goals.service";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import { todayIsoDate } from "@/utils/health";

export async function completeHabitAction(
  habitId: string
): Promise<{ error: string | null }> {
  try {
    const { supabase, userId } = await getDataContext();
    const repo = new BaseRepository(supabase, "health_habits", userId);
    const { error } = await repo.update(habitId, {
      status: "concluido",
      data: todayIsoDate(),
    });
    if (error) return { error };
    invalidateAuraIntelligenceCache({ userId, reason: "habito" });
    revalidatePath("/dashboard");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao concluir hábito." };
  }
}

export async function updateGoalProgressAction(params: {
  goalId: string;
  atual: number;
}): Promise<{ error: string | null }> {
  try {
    const atual = Number(params.atual);
    if (!Number.isFinite(atual) || atual < 0) {
      return { error: "Progresso inválido." };
    }
    const { userId } = await getDataContext();
    const { error } = await updateGoal(params.goalId, { atual });
    if (error) return { error };
    invalidateAuraIntelligenceCache({ userId, reason: "objetivo" });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/metas");
    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao atualizar objetivo.",
    };
  }
}
