"use server";

import { revalidatePath } from "next/cache";
import type { AuraPersonality, SessionFocus } from "@/lib/orchestrator/types";
import {
  loadOrchestratorHome,
  getOrchestratorGlobalContext,
  updatePersonalityPayload,
  updateSessionFocusActionPayload,
} from "@/lib/supabase/services/orchestrator.service";
import {
  listCommandSuggestions,
  parseCommandIntent,
  parseNaturalSearchQuery,
  resolveSearchQueryForIndex,
} from "@/lib/orchestrator";

function revalidateHome() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/aura-brain");
}

export async function getAuraHomeAction() {
  return loadOrchestratorHome({ bypassCache: true });
}

export async function getGlobalContextAction() {
  return getOrchestratorGlobalContext();
}

export async function setSessionFocusAction(patch: Partial<SessionFocus>) {
  const result = await updateSessionFocusActionPayload(patch);
  revalidateHome();
  return result;
}

export async function setActiveProjectAction(projectId: string | null) {
  return setSessionFocusAction({ projectId });
}

export async function updatePersonalityAction(patch: Partial<AuraPersonality>) {
  const result = await updatePersonalityPayload(patch);
  revalidateHome();
  return result;
}

export async function parseCommandPaletteAction(query: string) {
  return {
    intent: parseCommandIntent(query),
    suggestions: listCommandSuggestions(query, 8),
  };
}

export async function parseNaturalSearchAction(query: string) {
  const intent = parseNaturalSearchQuery(query);
  const resolved = resolveSearchQueryForIndex(query);
  return { intent, resolved };
}
