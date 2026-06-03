import type { Evento } from "@/types/database";

export type GoogleCalendarPublicStatus = {
  connected: boolean;
  configured: boolean;
  email: string | null;
  calendarId: string | null;
};

export type GoogleSyncStatus = "synced" | "pending" | "error";

export const GOOGLE_SYNC_STATUS_LABELS: Record<GoogleSyncStatus, string> = {
  synced: "Sincronizado",
  pending: "Pendente",
  error: "Erro",
};

export const GOOGLE_SYNC_STATUS_STYLES: Record<GoogleSyncStatus, string> = {
  synced: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  error: "text-red-400 bg-red-500/10 border-red-500/20",
};

export function getGoogleSyncStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  if (status in GOOGLE_SYNC_STATUS_LABELS) {
    return GOOGLE_SYNC_STATUS_LABELS[status as GoogleSyncStatus];
  }
  return null;
}

export function getEventoGoogleSyncStatus(evento: Evento): GoogleSyncStatus | null {
  const status = evento.google_sync_status;
  if (status === "synced" || status === "pending" || status === "error") {
    return status;
  }
  return null;
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_REDIRECT_URI || process.env.NEXT_PUBLIC_SITE_URL)
  );
}
