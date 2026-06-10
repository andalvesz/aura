"use client";

import { useCallback, useEffect, useState } from "react";
import type { GlobalMarket, GlobalResult, GlobalStrategy } from "@/types/database";
import type { GlobalDashboardMetrics, GlobalMarketIntake } from "@/utils/global";
import { parseJsonResponse } from "@/utils/safe-json";

export function useGlobal() {
  const [dashboard, setDashboard] = useState<GlobalDashboardMetrics | null>(null);
  const [markets, setMarkets] = useState<GlobalMarket[]>([]);
  const [strategies, setStrategies] = useState<GlobalStrategy[]>([]);
  const [results, setResults] = useState<GlobalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/global");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: GlobalDashboardMetrics;
        markets?: GlobalMarket[];
        strategies?: GlobalStrategy[];
        results?: GlobalResult[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Global Intelligence.");
        setDashboard(null);
        setMarkets([]);
        setStrategies([]);
        setResults([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setMarkets(data.markets ?? []);
      setStrategies(data.strategies ?? []);
      setResults(data.results ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function analyze(input: GlobalMarketIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/global/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        markets?: GlobalMarket[];
        strategies?: GlobalStrategy[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        return { error: data?.error ?? parseError ?? "Erro ao gerar estratégias." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function syncResults() {
    setBusy(true);
    try {
      const res = await fetch("/api/global?action=sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        synced?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao sincronizar." };
      }

      await refresh();
      return { error: null, synced: data?.synced ?? 0 };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeMarket(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/global?id=${id}`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao remover mercado." };
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
    markets,
    strategies,
    results,
    loading,
    error,
    busy,
    refresh,
    analyze,
    syncResults,
    removeMarket,
  };
}
