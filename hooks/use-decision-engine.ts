"use client";

import { useCallback, useState } from "react";
import type { UnifiedDecisionEngineResult } from "@/utils/aura-decision-engine";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useDecisionEngine() {
  const [decisions, setDecisions] = useState<UnifiedDecisionEngineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aura-decision-engine");
      const { data, error: parseError } = await parseJsonResponse<{
        decisions?: UnifiedDecisionEngineResult;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Decision Engine.");
        setDecisions(null);
        return;
      }

      setDecisions(data?.decisions ?? null);
    } catch {
      setError("Erro de conexão.");
      setDecisions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(refresh, [refresh]);

  return { decisions, loading, error, refresh };
}
