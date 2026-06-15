"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuraSmartLaunchSession } from "@/types/database";
import type {
  SmartLaunchCenterData,
  SmartLaunchDashboardMetrics,
  SmartLaunchIntake,
} from "@/utils/smart-launch";
import { parseJsonResponse } from "@/utils/safe-json";

export function useSmartLaunch(sessionId?: string | null) {
  const [dashboard, setDashboard] = useState<SmartLaunchDashboardMetrics | null>(null);
  const [center, setCenter] = useState<SmartLaunchCenterData | null>(null);
  const [sessions, setSessions] = useState<AuraSmartLaunchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (sid?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = sid ? `?session_id=${encodeURIComponent(sid)}` : "";
      const res = await fetch(`/api/smart-launch${query}`);
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: SmartLaunchDashboardMetrics;
        center?: SmartLaunchCenterData;
        sessions?: AuraSmartLaunchSession[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Smart Launch.");
        setDashboard(null);
        setCenter(null);
        setSessions([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setCenter(data.center ?? null);
      setSessions(data.sessions ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setCenter(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(sessionId);
  }, [refresh, sessionId]);

  async function prepare(input: SmartLaunchIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/smart-launch/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        session?: AuraSmartLaunchSession;
        center?: SmartLaunchCenterData;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.session) {
        return {
          session: null,
          error: data?.error ?? parseError ?? "Erro ao preparar lançamento.",
        };
      }

      await refresh(data.session.id);
      return { session: data.session, error: null };
    } catch {
      return { session: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/smart-launch?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao excluir." };
      }

      await refresh(sessionId);
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    center,
    sessions,
    loading,
    error,
    busy,
    refresh,
    prepare,
    removeSession,
  };
}
