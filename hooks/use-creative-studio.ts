"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorAsset } from "@/types/database";
import type {
  StudioDashboardMetrics,
  StudioGenerateKind,
  StudioIntake,
} from "@/utils/creative-studio";
import { parseJsonResponse } from "@/utils/safe-json";

export function useCreativeStudio() {
  const [dashboard, setDashboard] = useState<StudioDashboardMetrics | null>(null);
  const [records, setRecords] = useState<CreatorAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/studio");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: StudioDashboardMetrics;
        records?: CreatorAsset[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar ativos.");
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

  async function generate(input: StudioIntake, kind: StudioGenerateKind = "full") {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, kind }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        record?: CreatorAsset;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.record) {
        return { record: null, error: data?.error ?? parseError ?? "Erro ao gerar ativos." };
      }

      await refresh();
      return { record: data.record, error: null };
    } catch {
      return { record: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/studio?id=${encodeURIComponent(id)}`, {
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
    generate,
    removeRecord,
  };
}
