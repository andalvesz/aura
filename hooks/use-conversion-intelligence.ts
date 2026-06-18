"use client";

import { useCallback, useState } from "react";
import type {
  ConversionAnalysisResult,
  ConversionIntelligenceDashboard,
  ConversionIntelligenceIntake,
  ConversionRecommendation,
} from "@/utils/conversion-intelligence";
import type { ConversionInsight } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useConversionIntelligence() {
  const [dashboard, setDashboard] = useState<ConversionIntelligenceDashboard | null>(null);
  const [insights, setInsights] = useState<ConversionInsight[]>([]);
  const [recommendations, setRecommendations] = useState<ConversionRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversion-intelligence");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ConversionIntelligenceDashboard;
        insights?: ConversionInsight[];
        recommendations?: ConversionRecommendation[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Conversion Intelligence.");
        setDashboard(null);
        setInsights([]);
        setRecommendations([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setInsights(data.insights ?? []);
      setRecommendations(data.recommendations ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setInsights([]);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyze = useCallback(
    async (input: ConversionIntelligenceIntake = {}) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/conversion-intelligence/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          result?: ConversionAnalysisResult;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao analisar conversões.");
          return false;
        }

        await refresh();
        return true;
      } catch {
        setError("Erro de conexão.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useMountFetch(refresh, [refresh]);

  return { dashboard, insights, recommendations, loading, error, busy, refresh, analyze };
}
