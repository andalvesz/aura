"use client";

import { useCallback, useEffect, useState } from "react";
import type { PerformanceInsight, PerformanceMetric, PerformanceReport } from "@/types/database";
import type {
  PerformanceAiAnalysis,
  PerformanceDashboardMetrics,
  PerformanceExecutiveMemory,
  PerformancePanel,
} from "@/utils/performance";
import { parseJsonResponse } from "@/utils/safe-json";

export function usePerformance() {
  const [dashboard, setDashboard] = useState<PerformanceDashboardMetrics | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [panel, setPanel] = useState<PerformancePanel | null>(null);
  const [analysis, setAnalysis] = useState<PerformanceAiAnalysis | null>(null);
  const [executiveMemory, setExecutiveMemory] = useState<PerformanceExecutiveMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/performance");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: PerformanceDashboardMetrics;
        report?: PerformanceReport;
        metrics?: PerformanceMetric[];
        insights?: PerformanceInsight[];
        panel?: PerformancePanel;
        analysis?: PerformanceAiAnalysis;
        executiveMemory?: PerformanceExecutiveMemory;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Performance AI.");
        setDashboard(null);
        setReport(null);
        setMetrics([]);
        setInsights([]);
        setPanel(null);
        setAnalysis(null);
        setExecutiveMemory(null);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setReport(data.report ?? null);
      setMetrics(data.metrics ?? []);
      setInsights(data.insights ?? []);
      setPanel(data.panel ?? null);
      setAnalysis(data.analysis ?? null);
      setExecutiveMemory(data.executiveMemory ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setReport(null);
      setMetrics([]);
      setInsights([]);
      setPanel(null);
      setAnalysis(null);
      setExecutiveMemory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generateReport() {
    setBusy(true);
    try {
      const res = await fetch("/api/performance/generate", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        report?: PerformanceReport;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.report) {
        return { error: data?.error ?? parseError ?? "Erro ao gerar análise." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeReport(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/performance?id=${encodeURIComponent(id)}`, {
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
    report,
    metrics,
    insights,
    panel,
    analysis,
    executiveMemory,
    loading,
    error,
    busy,
    refresh,
    generateReport,
    removeReport,
  };
}
