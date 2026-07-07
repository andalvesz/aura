"use client";

import { useCallback, useState } from "react";
import type { InvestmentCommitteeReport } from "@/lib/investment-committee/investment-committee-types";
import type { ProductBuildBrief } from "@/utils/product-build-brief";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import type { SalesPackage } from "@/utils/sales-system";
import { parseJsonResponse } from "@/utils/safe-json";

export function useInvestmentCommittee() {
  const [report, setReport] = useState<InvestmentCommitteeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audit = useCallback(
    async (input: {
      salesPackage: SalesPackage;
      meta?: MasterFlowMetadata;
      productBuildBrief?: ProductBuildBrief | null;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/investment-committee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        const { data, error: parseError } = await parseJsonResponse<{
          report?: InvestmentCommitteeReport;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error || !data?.report) {
          setError(data?.error ?? parseError ?? "Erro ao auditar missão.");
          setReport(null);
          return null;
        }

        setReport(data.report);
        return data.report;
      } catch {
        setError("Erro de conexão.");
        setReport(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return { report, loading, error, audit, reset };
}
