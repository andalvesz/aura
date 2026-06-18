"use client";

import { useCallback, useState } from "react";
import type { RevenueAiDashboard, RevenueForecastResult } from "@/utils/revenue-ai";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useRevenueAi() {
  const [dashboard, setDashboard] = useState<RevenueAiDashboard | null>(null);
  const [forecast, setForecast] = useState<RevenueForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, forecastRes] = await Promise.all([
        fetch("/api/revenue-ai"),
        fetch("/api/revenue-ai/forecast?period=monthly"),
      ]);

      const { data: dashData, error: dashParseError } = await parseJsonResponse<{
        dashboard?: RevenueAiDashboard;
        error?: string;
      }>(dashRes);

      const { data: forecastData } = await parseJsonResponse<{
        result?: RevenueForecastResult;
        error?: string;
      }>(forecastRes);

      if (dashParseError || !dashRes.ok || !dashData || dashData.error) {
        setError(dashData?.error ?? dashParseError ?? "Erro ao carregar Revenue AI.");
        setDashboard(null);
        return;
      }

      setDashboard(dashData.dashboard ?? null);
      setForecast(forecastData?.result ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(refresh, [refresh]);

  return { dashboard, forecast, loading, error, refresh };
}
