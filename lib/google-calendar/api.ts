import type { Evento } from "@/types/database";
import { GOOGLE_CALENDAR_TIMEZONE } from "./config";

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
};

type EventsListResponse = {
  items?: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
};

function defaultEndIso(startIso: string): string {
  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
}

export function auraEventoToGoogleBody(evento: Evento): GoogleCalendarEvent {
  const startIso = evento.data_inicio;
  const endIso = evento.data_fim ?? defaultEndIso(startIso);

  return {
    summary: evento.titulo,
    description: evento.descricao ?? undefined,
    location: evento.local ?? undefined,
    start: {
      dateTime: startIso,
      timeZone: GOOGLE_CALENDAR_TIMEZONE,
    },
    end: {
      dateTime: endIso,
      timeZone: GOOGLE_CALENDAR_TIMEZONE,
    },
  };
}

export function googleEventToAuraPayload(
  item: GoogleCalendarEvent,
  userId: string
): Omit<Evento, "id" | "created_at" | "updated_at"> | null {
  if (!item.id || item.status === "cancelled") return null;

  const startRaw = item.start?.dateTime ?? item.start?.date;
  if (!startRaw) return null;

  const startIso = startRaw.includes("T")
    ? new Date(startRaw).toISOString()
    : new Date(`${startRaw}T12:00:00`).toISOString();

  const endRaw = item.end?.dateTime ?? item.end?.date;
  const endIso = endRaw
    ? endRaw.includes("T")
      ? new Date(endRaw).toISOString()
      : new Date(`${endRaw}T13:00:00`).toISOString()
    : null;

  return {
    user_id: userId,
    titulo: item.summary?.trim() || "Evento Google",
    descricao: item.description?.trim() || null,
    data_inicio: startIso,
    data_fim: endIso,
    local: item.location?.trim() || null,
    tipo: "geral",
    growth_lead_id: null,
    google_event_id: item.id,
    google_sync_status: "synced",
  };
}

export async function googleCalendarInsert(
  accessToken: string,
  calendarId: string,
  body: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<GoogleCalendarEvent>;
}

export async function googleCalendarUpdate(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<GoogleCalendarEvent>;
}

export async function googleCalendarDelete(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(await res.text());
  }
}

export async function googleCalendarListEvents(
  accessToken: string,
  calendarId: string,
  options: {
    syncToken?: string | null;
    timeMin?: string;
    timeMax?: string;
    pageToken?: string;
  } = {}
): Promise<EventsListResponse> {
  const params = new URLSearchParams({
    singleEvents: "true",
    showDeleted: "false",
    maxResults: "100",
  });

  if (options.syncToken) {
    params.set("syncToken", options.syncToken);
  } else {
    params.set("orderBy", "startTime");
    if (options.timeMin) params.set("timeMin", options.timeMin);
    if (options.timeMax) params.set("timeMax", options.timeMax);
  }
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<EventsListResponse>;
}
