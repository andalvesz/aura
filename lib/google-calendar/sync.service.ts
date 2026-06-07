import { EventosRepository } from "@/lib/supabase/repositories";
import { getDataContext } from "@/lib/supabase/services/context";
import type { Evento } from "@/types/database";
import {
  auraEventoToGoogleBody,
  googleCalendarDelete,
  googleCalendarInsert,
  googleCalendarListEvents,
  googleCalendarUpdate,
  googleEventToAuraPayload,
} from "./api";
import {
  getGoogleCalendarConnection,
  getValidGoogleAccessToken,
  updateGoogleSyncToken,
} from "./connection.service";

async function setEventoSyncState(
  eventoId: string,
  patch: { google_event_id?: string | null; google_sync_status: "synced" | "pending" | "error" }
) {
  const { supabase, userId } = await getDataContext();
  await new EventosRepository(supabase, userId).update(eventoId, patch);
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const { connection } = await getGoogleCalendarConnection();
  return Boolean(connection);
}

export async function pushEventoToGoogle(eventoId: string): Promise<{
  synced: boolean;
  skipped: boolean;
  error: string | null;
}> {
  const { accessToken, calendarId, error: tokenError } = await getValidGoogleAccessToken();

  if (tokenError || !accessToken || !calendarId) {
    return { synced: false, skipped: !tokenError, error: tokenError };
  }

  const { supabase, userId } = await getDataContext();
  const repo = new EventosRepository(supabase, userId);
  const { data: evento, error: loadError } = await repo.findById(eventoId);

  if (loadError || !evento) {
    return { synced: false, skipped: false, error: loadError ?? "Evento não encontrado." };
  }

  await setEventoSyncState(eventoId, { google_sync_status: "pending" });

  try {
    const body = auraEventoToGoogleBody(evento);
    let googleId = evento.google_event_id;

    if (googleId) {
      const updated = await googleCalendarUpdate(
        accessToken,
        calendarId,
        googleId,
        body
      );
      googleId = updated.id ?? googleId;
    } else {
      const created = await googleCalendarInsert(accessToken, calendarId, body);
      googleId = created.id ?? null;
    }

    if (!googleId) {
      await setEventoSyncState(eventoId, { google_sync_status: "error" });
      return { synced: false, skipped: false, error: "Google não retornou ID do evento." };
    }

    await setEventoSyncState(eventoId, {
      google_event_id: googleId,
      google_sync_status: "synced",
    });

    return { synced: true, skipped: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar com Google.";
    await setEventoSyncState(eventoId, { google_sync_status: "error" });
    return { synced: false, skipped: false, error: message };
  }
}

export async function deleteEventoFromGoogle(evento: Pick<Evento, "google_event_id">): Promise<{
  deleted: boolean;
  skipped: boolean;
  error: string | null;
}> {
  if (!evento.google_event_id) {
    return { deleted: false, skipped: true, error: null };
  }

  const { accessToken, calendarId, error: tokenError } = await getValidGoogleAccessToken();
  if (tokenError || !accessToken || !calendarId) {
    return { deleted: false, skipped: true, error: tokenError };
  }

  try {
    await googleCalendarDelete(accessToken, calendarId, evento.google_event_id);
    return { deleted: true, skipped: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao remover no Google.";
    return { deleted: false, skipped: false, error: message };
  }
}

export async function importGoogleCalendarEvents(): Promise<{
  imported: number;
  updated: number;
  error: string | null;
}> {
  const { accessToken, calendarId, error: tokenError } = await getValidGoogleAccessToken();
  if (tokenError || !accessToken || !calendarId) {
    return { imported: 0, updated: 0, error: tokenError ?? "Google não conectado." };
  }

  const { supabase, userId } = await getDataContext();
  const repo = new EventosRepository(supabase, userId);

  const { data: existingRows } = await repo.findAll("data_inicio");
  const byGoogleId = new Map(
    (existingRows ?? [])
      .filter((e) => e.google_event_id)
      .map((e) => [e.google_event_id as string, e])
  );

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 120);

  let imported = 0;
  let updated = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  try {
    do {
      const list = await googleCalendarListEvents(accessToken, calendarId, {
        syncToken: pageToken ? undefined : nextSyncToken ?? undefined,
        timeMin: nextSyncToken ? undefined : timeMin.toISOString(),
        timeMax: nextSyncToken ? undefined : timeMax.toISOString(),
        pageToken,
      });

      for (const item of list.items ?? []) {
        const payload = googleEventToAuraPayload(item, userId);
        if (!payload?.google_event_id) continue;

        const existing = byGoogleId.get(payload.google_event_id);
        if (existing) {
          const { error } = await repo.update(existing.id, {
            titulo: payload.titulo,
            descricao: payload.descricao,
            data_inicio: payload.data_inicio,
            data_fim: payload.data_fim,
            local: payload.local,
            google_sync_status: "synced",
          });
          if (!error) updated += 1;
          continue;
        }

        const { data, error } = await repo.create(payload);
        if (!error && data) {
          byGoogleId.set(payload.google_event_id, data);
          imported += 1;
        }
      }

      pageToken = list.nextPageToken;
      if (list.nextSyncToken) nextSyncToken = list.nextSyncToken;
    } while (pageToken);

    if (nextSyncToken) {
      await updateGoogleSyncToken(nextSyncToken);
    }

    return { imported, updated, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao importar do Google.";
    return { imported, updated, error: message };
  }
}
