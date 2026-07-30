"use server";

import { revalidatePath } from "next/cache";
import {
  archiveEntity,
  archiveRelationship,
  confirmRelationship,
  correctRelationship,
  rejectRelationship,
  bootstrapWorldModel,
} from "@/lib/supabase/services/world-model.service";

function revalidateWorld(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/world-model");
  revalidatePath("/dashboard/settings/aura-brain");
}

export async function confirmWorldRelationshipAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await confirmRelationship(id);
  revalidateWorld();
  return { error: res.error };
}

export async function rejectWorldRelationshipAction(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  if (!id || !reason?.trim()) return { error: "Parâmetros inválidos" };
  const res = await rejectRelationship(id, reason);
  revalidateWorld();
  return { error: res.error };
}

export async function correctWorldRelationshipAction(input: {
  relationshipId: string;
  relationshipType?: string;
  reason: string;
}): Promise<{ error: string | null }> {
  if (!input.relationshipId || !input.reason?.trim()) {
    return { error: "Parâmetros inválidos" };
  }
  const res = await correctRelationship(input);
  revalidateWorld();
  return { error: res.error };
}

export async function archiveWorldEntityAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await archiveEntity(id);
  revalidateWorld();
  return { error: res.error };
}

export async function archiveWorldRelationshipAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await archiveRelationship(id);
  revalidateWorld();
  return { error: res.error };
}

export async function bootstrapWorldModelAction(): Promise<{
  error: string | null;
  created?: number;
}> {
  const res = await bootstrapWorldModel({ maxItems: 50 });
  revalidateWorld();
  return { error: res.error, created: res.report.created };
}
