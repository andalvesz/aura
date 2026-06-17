"use client";

import { useCallback, useEffect, useState } from "react";
import type { GrowthBrainDashboard } from "@/utils/growth-brain";
import { parseJsonResponse } from "@/utils/safe-json";

export function useGrowthBrain() {
  const [dashboard, setDashboard] = useState<GrowthBrainDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/growth-brain");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: GrowthBrainDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Growth Brain.");
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
