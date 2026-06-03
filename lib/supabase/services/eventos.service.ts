import { EventosRepository } from "@/lib/supabase/repositories";
import {
  deleteEventoFromGoogle,
  isGoogleCalendarConnected,
  pushEventoToGoogle,
} from "@/lib/google-calendar";
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

async function syncEventoToGoogleIfConnected(eventoId: string) {
  try {
    if (await isGoogleCalendarConnected()) {
      await pushEventoToGoogle(eventoId);
    }
  } catch {
    /* Supabase permanece fonte de verdade; falha Google não bloqueia */
  }
}

export async function createEvento(payload: Omit<TableInsert<"eventos">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  const result = await new EventosRepository(supabase, userId).create(payload);
  if (result.data?.id) {
    void syncEventoToGoogleIfConnected(result.data.id);
  }
  return result;
}

export async function updateEvento(id: string, payload: TableUpdate<"eventos">) {
  const { supabase, userId } = await getDataContext();
  const result = await new EventosRepository(supabase, userId).update(id, payload);
  if (result.data?.id) {
    void syncEventoToGoogleIfConnected(result.data.id);
  }
  return result;
}

export async function deleteEvento(id: string) {
  const { supabase, userId } = await getDataContext();
  const repo = new EventosRepository(supabase, userId);
  const { data: evento } = await repo.findById(id);
  if (evento?.google_event_id) {
    void deleteEventoFromGoogle(evento);
  }
  return repo.delete(id);
}
