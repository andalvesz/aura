"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketHunterDashboard } from "@/utils/market-hunter";
import { parseJsonResponse } from "@/utils/safe-json";

export function useMarketHunter() {
  const [dashboard, setDashboard] = useState<MarketHunterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-hunter");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: MarketHunterDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Market Hunter.");
        setDashboard(null);
        return;
      }

      setDashboard(data.dashboard ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-hunter/analyze", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao analisar mercado.");
        return false;
      }

      await refresh();
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh, analyze };
}
