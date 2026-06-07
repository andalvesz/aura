import { TripChecklistRepository } from "@/lib/supabase/repositories/trip-checklist.repository";
import { TripsRepository } from "@/lib/supabase/repositories/trips.repository";
import type { TableInsert, Trip, TripChecklistItem } from "@/types/database";
import { resolveChecklistSeed } from "@/utils/travel";
import { getOptionalDataContext } from "./context";

export async function listTrips(): Promise<{ trips: Trip[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { trips: [], error: "Usuário não autenticado." };

  const repo = new TripsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAll("data_ida");
  return { trips: data ?? [], error };
}

export async function listTripChecklist(
  tripId: string
): Promise<{ items: TripChecklistItem[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { items: [], error: "Usuário não autenticado." };

  const repo = new TripChecklistRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findByTrip(tripId);
  return { items: data ?? [], error };
}

export async function seedTripChecklist(
  tripId: string,
  templateId: string | null | undefined
): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const items = resolveChecklistSeed(templateId);
  const repo = new TripChecklistRepository(ctx.supabase, ctx.userId);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { error } = await repo.create({
      trip_id: tripId,
      categoria: item.categoria,
      titulo: item.titulo,
      status: "pendente",
      ordem: i,
    } satisfies Omit<TableInsert<"trip_checklist_items">, "user_id">);
    if (error) return { error };
  }

  return { error: null };
}
