"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorLaunchPlan } from "@/types/database";
import type { LaunchCenterData, LaunchDashboardMetrics } from "@/utils/launch";
import { parseJsonResponse } from "@/utils/safe-json";

export function useLaunch() {
  const [dashboard, setDashboard] = useState<LaunchDashboardMetrics | null>(null);
  const [center, setCenter] = useState<LaunchCenterData | null>(null);
  const [plans, setPlans] = useState<CreatorLaunchPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/launch");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: LaunchDashboardMetrics;
        center?: LaunchCenterData;
        plans?: CreatorLaunchPlan[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Launch Center.");
        setDashboard(null);
        setCenter(null);
        setPlans([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setCenter(data.center ?? null);
      setPlans(data.plans ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setCenter(null);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startLaunch(productId?: string, orcamentoDisponivel?: number | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/launch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, orcamento_disponivel: orcamentoDisponivel ?? null }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        plan?: CreatorLaunchPlan;
        center?: LaunchCenterData;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.plan) {
        return { plan: null, error: data?.error ?? parseError ?? "Erro ao iniciar lançamento." };
      }

      await refresh();
      return { plan: data.plan, error: null };
    } catch {
      return { plan: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/launch?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
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
    center,
    plans,
    loading,
    error,
    busy,
    refresh,
    startLaunch,
    removePlan,
  };
}
