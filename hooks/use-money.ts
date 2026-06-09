"use client";

import { useCallback, useEffect, useState } from "react";
import type { MoneyMissionPlan, MoneyMissionTask } from "@/types/database";
import type { MoneyDashboardMetrics, MoneyPrazo, MoneyPrioridade } from "@/utils/money";
import { parseJsonResponse } from "@/utils/safe-json";

export function useMoney() {
  const [dashboard, setDashboard] = useState<MoneyDashboardMetrics | null>(null);
  const [plan, setPlan] = useState<MoneyMissionPlan | null>(null);
  const [tasks, setTasks] = useState<MoneyMissionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/money");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: MoneyDashboardMetrics;
        plan?: MoneyMissionPlan;
        tasks?: MoneyMissionTask[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Money Missions.");
        setDashboard(null);
        setPlan(null);
        setTasks([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setPlan(data.plan ?? null);
      setTasks(data.tasks ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setPlan(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startMission(params: {
    valorMeta: number;
    prazo: MoneyPrazo;
    prioridade: MoneyPrioridade;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/money/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        plan?: MoneyMissionPlan;
        tasks?: MoneyMissionTask[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.plan) {
        return { plan: null, error: data?.error ?? parseError ?? "Erro ao criar plano." };
      }

      await refresh();
      return { plan: data.plan, error: null };
    } catch {
      return { plan: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(taskId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/money", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", taskId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{ task?: MoneyMissionTask; error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao concluir missão." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(valorConquistado: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/money", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "progress", valorConquistado }),
      });
      const { data, error: parseError } = await parseJsonResponse<{ plan?: MoneyMissionPlan; error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao atualizar progresso." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/money?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
    plan,
    tasks,
    loading,
    error,
    busy,
    refresh,
    startMission,
    completeTask,
    updateProgress,
    removePlan,
  };
}
