"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorCampaignOrchestration } from "@/types/database";
import type {
  OrchestratorCenterData,
  OrchestratorDashboardMetrics,
  OrchestratorIntake,
} from "@/utils/campaign-orchestrator";
import { parseJsonResponse } from "@/utils/safe-json";

type ProductOption = { id: string; nome: string | null };

export function useCampaignOrchestrator(productId?: string | null) {
  const [dashboard, setDashboard] = useState<OrchestratorDashboardMetrics | null>(null);
  const [center, setCenter] = useState<OrchestratorCenterData | null>(null);
  const [records, setRecords] = useState<CreatorCampaignOrchestration[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (pid?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = pid ? `?product_id=${encodeURIComponent(pid)}` : "";
      const res = await fetch(`/api/creator/orchestrator${query}`);
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: OrchestratorDashboardMetrics;
        center?: OrchestratorCenterData;
        records?: CreatorCampaignOrchestration[];
        bundles?: ProductOption[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar orquestrador.");
        setDashboard(null);
        setCenter(null);
        setRecords([]);
        setProducts([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setCenter(data.center ?? null);
      setRecords(data.records ?? []);
      setProducts(data.bundles ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setCenter(null);
      setRecords([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(productId);
  }, [refresh, productId]);

  async function prepare(input: OrchestratorIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/orchestrator/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        orchestration?: CreatorCampaignOrchestration;
        center?: OrchestratorCenterData;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.orchestration) {
        return {
          orchestration: null,
          error: data?.error ?? parseError ?? "Erro ao preparar lançamento.",
        };
      }

      await refresh(input.product_id);
      return { orchestration: data.orchestration, error: null };
    } catch {
      return { orchestration: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/orchestrator?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao excluir." };
      }

      await refresh(productId);
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    center,
    records,
    products,
    loading,
    error,
    busy,
    refresh,
    prepare,
    removeRecord,
  };
}
