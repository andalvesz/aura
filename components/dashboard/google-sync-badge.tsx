"use client";

import type { Evento } from "@/types/database";
import {
  getEventoGoogleSyncStatus,
  getGoogleSyncStatusLabel,
  GOOGLE_SYNC_STATUS_STYLES,
} from "@/utils/google-calendar";

type GoogleSyncBadgeProps = {
  evento: Evento;
  showWhenDisconnected?: boolean;
};

export function GoogleSyncBadge({ evento, showWhenDisconnected = false }: GoogleSyncBadgeProps) {
  const status = getEventoGoogleSyncStatus(evento);

  if (!status && !showWhenDisconnected) return null;
  if (!status) return null;

  const label = getGoogleSyncStatusLabel(status);
  if (!label) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-medium ${GOOGLE_SYNC_STATUS_STYLES[status]}`}
      title={`Google Calendar: ${label}`}
    >
      {label}
    </span>
  );
}
