"use client";

import { useCallback, useState } from "react";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";
import type {
  ProductStrategistResult,
  ProductStrategyRecommendation,
} from "@/lib/product-strategist/product-strategist-types";
import { parseJsonResponse } from "@/utils/safe-json";

export function useProductStrategist() {
  const [strategist, setStrategist] = useState<ProductStrategistResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ProductStrategyRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategize = useCallback(
    async (opportunity: OpportunityRecommendation, validation: ValidationResult) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/product-strategist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunity, validation }),
        });

        const { data, error: parseError } = await parseJsonResponse<{
          strategist?: ProductStrategistResult;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error || !data?.strategist) {
          setError(data?.error ?? parseError ?? "Erro ao gerar estratégias.");
          setStrategist(null);
          setSelectedStrategy(null);
          return null;
        }

        setStrategist(data.strategist);
        setSelectedStrategy(data.strategist.recommendation);
        return data.strategist;
      } catch {
        setError("Erro de conexão.");
        setStrategist(null);
        setSelectedStrategy(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStrategist(null);
    setSelectedStrategy(null);
    setError(null);
  }, []);

  return {
    strategist,
    selectedStrategy,
    loading,
    error,
    strategize,
    selectStrategy: setSelectedStrategy,
    reset,
  };
}
