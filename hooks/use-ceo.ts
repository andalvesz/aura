"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuraCeoSession } from "@/types/database";
import type { CeoDashboardMetrics, CeoOpportunityRadar } from "@/utils/ceo";
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
      const res = await fetch("/api/ceo");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: CeoDashboardMetrics;
        session?: AuraCeoSession;
        radar?: CeoOpportunityRadar;
        sessions?: AuraCeoSession[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Aura CEO.");
        setDashboard(null);
        setSession(null);
        setRadar(null);
        setSessions([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setSession(data.session ?? null);
      setRadar(data.radar ?? null);
      setSessions(data.sessions ?? []);
    } catch {
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
    } catch {
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
    } catch {
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
