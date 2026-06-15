"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionTask } from "@/types/database";
import type { DailyBriefing } from "@/utils/execution";
import type { MissionActionId, MissionControlDashboard } from "@/utils/mission-control";
import { parseJsonResponse } from "@/utils/safe-json";

export function useMissionControl() {
  const [dashboard, setDashboard] = useState<MissionControlDashboard | null>(null);
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mission");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: MissionControlDashboard;
        tasks?: ExecutionTask[];
        briefing?: DailyBriefing;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Mission Control.");
        setDashboard(null);
        setTasks([]);
        setBriefing(null);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setTasks(data.tasks ?? []);
      setBriefing(data.briefing ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setTasks([]);
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(action: MissionActionId) {
    setBusy(true);
    try {
      const res = await fetch("/api/mission/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro na ação." };
      }

      await refresh();
      return { message: data?.message ?? "Ação concluída.", error: data?.error ?? null };
    } catch {
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return { dashboard, tasks, briefing, loading, error, busy, refresh, runAction };
}
