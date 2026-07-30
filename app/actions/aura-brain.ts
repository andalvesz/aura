"use server";

import { revalidatePath } from "next/cache";
import type { AutonomyLevel } from "@/lib/aura-brain/types";
import { updateAuraBrainAutonomyAction as persist } from "@/lib/supabase/services/aura-brain-core.service";

export async function updateAuraBrainAutonomyAction(
  level: AutonomyLevel
): Promise<{ error: string | null }> {
  const allowed: AutonomyLevel[] = [
    "SUGGEST",
    "PREPARE",
    "CONFIRM",
    "AUTO_SAFE",
  ];
  if (!allowed.includes(level)) {
    return { error: "Nível inválido" };
  }
  const result = await persist(level);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/aura-brain");
  return result;
}
