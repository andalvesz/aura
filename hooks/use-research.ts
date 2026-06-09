"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorResearch } from "@/types/database";
import type { ResearchDashboardMetrics, ResearchIntake } from "@/utils/research";
import { parseJsonResponse } from "@/utils/safe-json";
import type { CreatorProductBundle } from "@/utils/creator";

export function useResearch() {
  const [dashboard, setDashboard] = useState<ResearchDashboardMetrics | null>(null);
  const [records, setRecords] = useState<CreatorResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/research");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ResearchDashboardMetrics;
        records?: CreatorResearch[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar pesquisas.");
        setDashboard(null);
        setRecords([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setRecords(data.records ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function analyze(input: ResearchIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/research/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        record?: CreatorResearch;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.record) {
        return { record: null, error: data?.error ?? parseError ?? "Erro na análise." };
      }

      await refresh();
      return { record: data.record, error: null };
    } catch {
      return { record: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function convertToProduct(researchId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/research/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: CreatorProductBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro ao criar produto." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/research?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao excluir." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    records,
    loading,
    error,
    busy,
    refresh,
    analyze,
    convertToProduct,
    removeRecord,
  };
}
