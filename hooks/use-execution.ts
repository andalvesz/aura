"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionHistoryEntry, ExecutionPlan, ExecutionTask } from "@/types/database";
import type { DailyBriefing, ExecutionDashboardMetrics } from "@/utils/execution";
import { parseJsonResponse } from "@/utils/safe-json";

export function useExecution() {
  const [dashboard, setDashboard] = useState<ExecutionDashboardMetrics | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [history, setHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/execution");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ExecutionDashboardMetrics;
        plan?: ExecutionPlan;
        tasks?: ExecutionTask[];
        briefing?: DailyBriefing;
        history?: ExecutionHistoryEntry[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Execution Engine.");
        setDashboard(null);
        setPlan(null);
        setTasks([]);
        setBriefing(null);
        setHistory([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setPlan(data.plan ?? null);
      setTasks(data.tasks ?? []);
      setBriefing(data.briefing ?? null);
      setHistory(data.history ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setPlan(null);
      setTasks([]);
      setBriefing(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generateDaily() {
    setBusy(true);
    try {
      const res = await fetch("/api/execution/daily", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        plan?: ExecutionPlan;
        tasks?: ExecutionTask[];
        briefing?: DailyBriefing;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.plan) {
        return { error: data?.error ?? parseError ?? "Erro ao gerar plano diário." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(taskId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/execution/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        task?: ExecutionTask;
        xpAwarded?: number;
        planComplete?: boolean;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return {
          xpAwarded: 0,
          planComplete: false,
          error: data?.error ?? parseError ?? "Erro ao concluir tarefa.",
        };
      }

      await refresh();
      return {
        xpAwarded: data?.xpAwarded ?? 0,
        planComplete: data?.planComplete ?? false,
        error: null,
      };
    } catch {
      return { xpAwarded: 0, planComplete: false, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/execution?id=${encodeURIComponent(id)}`, {
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
    plan,
    tasks,
    briefing,
    history,
    loading,
    error,
    busy,
    refresh,
    generateDaily,
    completeTask,
    removePlan,
  };
}
