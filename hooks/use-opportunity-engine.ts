"use client";

import { useCallback, useState } from "react";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { parseJsonResponse } from "@/utils/safe-json";

export function useOpportunityEngine() {
  const [opportunities, setOpportunities] = useState<OpportunityRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGoal, setLastGoal] = useState<string | null>(null);

  const search = useCallback(async (goal: string) => {
    const trimmed = goal.trim();
    if (!trimmed) {
      setError("Informe um objetivo financeiro.");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/opportunity-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        opportunities?: OpportunityRecommendation[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao buscar oportunidades.");
        setOpportunities([]);
        return false;
      }

      setOpportunities(data?.opportunities ?? []);
      setLastGoal(trimmed);
      return true;
    } catch {
      setError("Erro de conexão.");
      setOpportunities([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const selectOpportunity = useCallback((item: OpportunityRecommendation) => {
    return item;
  }, []);

  return {
    opportunities,
    loading,
    error,
    lastGoal,
    search,
    selectOpportunity,
  };
}
