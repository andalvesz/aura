"use client";

import { useCallback, useEffect, useState } from "react";
import type { OperationCenter } from "@/types/database";
import {
  computeOperationCenterDashboard,
  type OperationCenterDashboard,
} from "@/utils/operation-center";
import { fetchJsonWithTimeout } from "@/utils/fetch-json";
import { parseJsonResponse } from "@/utils/safe-json";

export type OperationAssetType = "creatives" | "landing" | "both";

function emptyOperationDashboard(): OperationCenterDashboard {
  return computeOperationCenterDashboard({
    operation: null,
    bundle: null,
    metaConnected: false,
    kiwifyConnected: false,
    hasPerformanceReport: false,
  });
}

export function useOperationCenter() {
  const [dashboard, setDashboard] = useState<OperationCenterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        dashboard?: OperationCenterDashboard;
        error?: string;
      }>("/api/operation-center");

      if (fetchError || timedOut) {
        console.error("[useOperationCenter] refresh failed:", fetchError, {
          status: res.status,
          timedOut,
        });
        setError(fetchError ?? "Erro ao carregar Operation Center.");
        setDashboard(emptyOperationDashboard());
        return;
      }

      if (!res.ok) {
        const message = data?.error ?? `Erro ao carregar Operation Center (${res.status}).`;
        console.error("[useOperationCenter] API error:", message, { status: res.status });
        setError(message);
        setDashboard(data?.dashboard ?? emptyOperationDashboard());
        return;
      }

      setDashboard(data?.dashboard ?? emptyOperationDashboard());
      if (data?.error) {
        console.warn("[useOperationCenter] API warning:", data.error);
      }
    } catch (err) {
      console.error("[useOperationCenter] unexpected error:", err);
      setError("Erro de conexão.");
      setDashboard(emptyOperationDashboard());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generateAssets(assetType: OperationAssetType = "both") {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center/generate-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId, assetType }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        operation?: OperationCenter;
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao gerar assets." };
      }

      await refresh();
      return { message: data?.message ?? "Assets gerados.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] generateAssets failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function prepareCampaign() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center/prepare-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao montar campanha." };
      }

      await refresh();
      return { message: data?.message ?? "Campanha montada.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] prepareCampaign failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function sendToPerformanceAi() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "performance_ai", operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao enviar para Performance AI." };
      }

      await refresh();
      return { message: data?.message ?? "Enviado para Performance AI.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] sendToPerformanceAi failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function approveOperation() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa.", missing: [] as string[] };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
        missing?: string[];
      }>(res);

      if (parseError || !res.ok) {
        return {
          message: null,
          error: data?.error ?? parseError ?? "Erro ao aprovar operação.",
          missing: data?.missing ?? [],
        };
      }

      await refresh();
      return {
        message: data?.message ?? "Operação aprovada.",
        error: data?.error ?? null,
        missing: data?.missing ?? [],
      };
    } catch (err) {
      console.error("[useOperationCenter] approveOperation failed:", err);
      return { message: null, error: "Erro de conexão.", missing: [] as string[] };
    } finally {
      setBusy(false);
    }
  }

  async function cancelOperation() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao cancelar operação." };
      }

      await refresh();
      return { message: data?.message ?? "Operação cancelada.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] cancelOperation failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    loading,
    error,
    busy,
    refresh,
    generateAssets,
    prepareCampaign,
    sendToPerformanceAi,
    approveOperation,
    cancelOperation,
  };
}
