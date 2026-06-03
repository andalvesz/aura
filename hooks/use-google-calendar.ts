"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoogleCalendarPublicStatus } from "@/utils/google-calendar";
import { parseJsonResponse } from "@/utils/safe-json";

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarPublicStatus>({
    connected: false,
    configured: false,
    email: null,
    calendarId: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google-calendar/status");
      const { data } = await parseJsonResponse<GoogleCalendarPublicStatus>(res);
      if (data) setStatus(data);
    } catch {
      /* mantém estado anterior */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(() => {
    window.location.href = "/api/google-calendar/connect";
  }, []);

  const disconnect = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ ok?: boolean; error?: string }>(
        res
      );
      if (parseError || !res.ok) {
        return { error: parseError ?? data?.error ?? "Erro ao desconectar." };
      }
      await refreshStatus();
      return { error: null };
    } catch {
      return { error: "Erro ao desconectar." };
    } finally {
      setActionLoading(false);
    }
  }, [refreshStatus]);

  const importEvents = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/google-calendar/import", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        imported?: number;
        updated?: number;
        error?: string;
      }>(res);
      if (parseError || !res.ok) {
        return {
          error: parseError ?? data?.error ?? "Erro ao importar.",
          imported: 0,
          updated: 0,
        };
      }
      await refreshStatus();
      return {
        error: null,
        imported: data?.imported ?? 0,
        updated: data?.updated ?? 0,
      };
    } catch {
      return { error: "Erro ao importar.", imported: 0, updated: 0 };
    } finally {
      setActionLoading(false);
    }
  }, [refreshStatus]);

  return {
    status,
    loading,
    actionLoading,
    connect,
    disconnect,
    importEvents,
    refreshStatus,
  };
}
