"use client";

import { useCallback, useEffect, useState } from "react";
import type { RevenueDashboardMetrics } from "@/utils/revenue";
import { parseJsonResponse } from "@/utils/safe-json";

export function useRevenue() {
  const [dashboard, setDashboard] = useState<RevenueDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/revenue");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: RevenueDashboardMetrics;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Revenue Center.");
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
