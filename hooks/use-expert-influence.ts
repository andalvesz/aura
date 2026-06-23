"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExpertInfluenceDashboard } from "@/utils/expert-influence";
import { INFLUENCE_MODULE_LABELS, INFLUENCE_WARNING_THRESHOLD } from "@/utils/expert-influence";
import { parseJsonResponse } from "@/utils/safe-json";

export function useExpertInfluence() {
  const [dashboard, setDashboard] = useState<ExpertInfluenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/expert-brain/influence");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ExpertInfluenceDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar auditoria.");
        setDashboard(null);
        return;
      }

      setDashboard(data?.dashboard ?? null);
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

  return { dashboard, loading, error, refresh, INFLUENCE_MODULE_LABELS, INFLUENCE_WARNING_THRESHOLD };
}
