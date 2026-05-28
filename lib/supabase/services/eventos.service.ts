import { EventosRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listEventos() {
  const { supabase, userId } = await getDataContext();
  return new EventosRepository(supabase, userId).findAll();
}

export async function listUpcomingEventos(limit = 10) {
  const { supabase, userId } = await getDataContext();
  return new EventosRepository(supabase, userId).findUpcoming(limit);
}

export async function createEvento(payload: Omit<TableInsert<"eventos">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  return new EventosRepository(supabase, userId).create(payload);
}

export async function updateEvento(id: string, payload: TableUpdate<"eventos">) {
  const { supabase, userId } = await getDataContext();
  return new EventosRepository(supabase, userId).update(id, payload);
}

export async function deleteEvento(id: string) {
  const { supabase, userId } = await getDataContext();
  return new EventosRepository(supabase, userId).delete(id);
}
