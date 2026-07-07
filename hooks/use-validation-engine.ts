"use client";

import { useCallback, useState } from "react";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationInsights, ValidationResult } from "@/lib/validation/validation-types";
import { extractValidationInsights } from "@/lib/validation/validation-engine";
import { parseJsonResponse } from "@/utils/safe-json";

export function useValidationEngine() {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [insights, setInsights] = useState<ValidationInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (opportunity: OpportunityRecommendation) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/validation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        validation?: ValidationResult;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error || !data?.validation) {
        setError(data?.error ?? parseError ?? "Erro ao validar oportunidade.");
        setValidation(null);
        setInsights(null);
        return null;
      }

      setValidation(data.validation);
      setInsights(extractValidationInsights(data.validation));
      return data.validation;
    } catch {
      setError("Erro de conexão.");
      setValidation(null);
      setInsights(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setValidation(null);
    setInsights(null);
    setError(null);
  }, []);

  return {
    validation,
    insights,
    loading,
    error,
    validate,
    reset,
  };
}
