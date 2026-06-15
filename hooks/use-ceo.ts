"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuraCeoSession } from "@/types/database";
import type { CeoDashboardMetrics, CeoOpportunityRadar } from "@/utils/ceo";
import { fetchJsonWithTimeout } from "@/utils/fetch-json";
import { parseJsonResponse } from "@/utils/safe-json";

export function useCeo() {
  const [dashboard, setDashboard] = useState<CeoDashboardMetrics | null>(null);
  const [session, setSession] = useState<AuraCeoSession | null>(null);
  const [radar, setRadar] = useState<CeoOpportunityRadar | null>(null);
  const [sessions, setSessions] = useState<AuraCeoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        dashboard?: CeoDashboardMetrics;
        session?: AuraCeoSession;
        radar?: CeoOpportunityRadar;
        sessions?: AuraCeoSession[];
        error?: string;
      }>("/api/ceo");

      if (fetchError || timedOut) {
        console.error("[useCeo] refresh failed:", fetchError, { status: res.status, timedOut });
        setError(fetchError ?? "Erro ao carregar Aura CEO.");
        setDashboard(null);
        setSession(null);
        setRadar(null);
        setSessions([]);
        return;
      }

      if (!res.ok || data?.error) {
        const message = data?.error ?? `Erro ao carregar Aura CEO (${res.status}).`;
        console.error("[useCeo] API error:", message, { status: res.status });
        setError(message);
        setDashboard(data?.dashboard ?? null);
        setSession(data?.session ?? null);
        setRadar(data?.radar ?? null);
        setSessions(data?.sessions ?? []);
        return;
      }

      setDashboard(data?.dashboard ?? null);
      setSession(data?.session ?? null);
      setRadar(data?.radar ?? null);
      setSessions(data?.sessions ?? []);
    } catch (err) {
      console.error("[useCeo] unexpected error:", err);
      setError("Erro de conexão.");
      setDashboard(null);
      setSession(null);
      setRadar(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createPlan(pergunta: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ceo/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        session?: AuraCeoSession;
        radar?: CeoOpportunityRadar;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.session) {
        return { session: null, error: data?.error ?? parseError ?? "Erro ao gerar plano." };
      }

      await refresh();
      return { session: data.session, error: null };
    } catch (err) {
      console.error("[useCeo] createPlan failed:", err);
      return { session: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ceo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao excluir." };
      }

      await refresh();
      return { error: null };
    } catch (err) {
      console.error("[useCeo] removeSession failed:", err);
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    session,
    radar,
    sessions,
    loading,
    error,
    busy,
    refresh,
    createPlan,
    removeSession,
  };
}
