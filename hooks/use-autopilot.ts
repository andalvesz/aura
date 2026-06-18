"use client";

import { useCallback, useState } from "react";
import type {
  AutopilotAction,
  AutopilotControlLevel,
  AutopilotLog,
  AutopilotMonitor,
  AutopilotSettings,
  CreatorAdsCampaign,
} from "@/types/database";
import type {
  AutopilotDashboardMetrics,
  AutopilotRules,
  ManualActionType,
} from "@/utils/autopilot";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useAutopilot() {
  const [dashboard, setDashboard] = useState<AutopilotDashboardMetrics | null>(null);
  const [settings, setSettings] = useState<AutopilotSettings | null>(null);
  const [rules, setRules] = useState<AutopilotRules | null>(null);
  const [campaigns, setCampaigns] = useState<CreatorAdsCampaign[]>([]);
  const [monitors, setMonitors] = useState<AutopilotMonitor[]>([]);
  const [actions, setActions] = useState<AutopilotAction[]>([]);
  const [logs, setLogs] = useState<AutopilotLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/autopilot");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: AutopilotDashboardMetrics;
        settings?: AutopilotSettings;
        rules?: AutopilotRules;
        campaigns?: CreatorAdsCampaign[];
        monitors?: AutopilotMonitor[];
        actions?: AutopilotAction[];
        logs?: AutopilotLog[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Autopilot.");
        setDashboard(null);
        setSettings(null);
        setRules(null);
        setCampaigns([]);
        setMonitors([]);
        setActions([]);
        setLogs([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setSettings(data.settings ?? null);
      setRules(data.rules ?? null);
      setCampaigns(data.campaigns ?? []);
      setMonitors(data.monitors ?? []);
      setActions(data.actions ?? []);
      setLogs(data.logs ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(refresh, [refresh]);

  async function updateSettings(input: {
    control_level?: AutopilotControlLevel;
    rules?: AutopilotRules;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        settings?: AutopilotSettings;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao salvar configurações." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function runManual(campaignId: string, actionType: ManualActionType) {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual", campaignId, actionType }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        action?: AutopilotAction;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao executar ação." };
      }

      await refresh();
      return { error: null, action: data?.action ?? null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function evaluateRules() {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate" }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        evaluated?: number;
        triggered?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao avaliar regras." };
      }

      await refresh();
      return {
        error: null,
        evaluated: data?.evaluated ?? 0,
        triggered: data?.triggered ?? 0,
      };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function approveAction(actionId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", actionId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao aprovar." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function rejectAction(actionId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", actionId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao rejeitar." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function fixWithAi(actionId?: string, message?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, message }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { text: null, error: data?.error ?? parseError ?? "Erro na IA." };
      }

      return { text: data?.text ?? null, error: null };
    } catch {
      return { text: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    settings,
    rules,
    campaigns,
    monitors,
    actions,
    logs,
    loading,
    error,
    busy,
    refresh,
    updateSettings,
    runManual,
    evaluateRules,
    approveAction,
    rejectAction,
    fixWithAi,
  };
}
