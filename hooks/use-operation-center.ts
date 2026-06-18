"use client";

import { useCallback, useState } from "react";
import type { CreativeAssetType, OperationCenter } from "@/types/database";
import {
  computeOperationCenterDashboard,
  type OperationCenterDashboard,
} from "@/utils/operation-center";
import { fetchJsonWithTimeout } from "@/utils/fetch-json";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export type OperationAssetType = "creatives" | "landing" | "both";

export const OPERATION_CENTER_INITIAL_LOAD_TIMEOUT_MS = 8_000;
export const OPERATION_CENTER_BACKGROUND_LOAD_MESSAGE =
  "Alguns dados ainda estão carregando em segundo plano.";

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
  const [dashboard, setDashboard] = useState<OperationCenterDashboard>(() =>
    emptyOperationDashboard()
  );
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        dashboard?: OperationCenterDashboard;
        error?: string;
      }>("/api/operation-center", {
        timeoutMs: OPERATION_CENTER_INITIAL_LOAD_TIMEOUT_MS,
      });

      if (timedOut) {
        console.warn("[useOperationCenter] refresh timed out");
        setDashboard(emptyOperationDashboard());
        setError(OPERATION_CENTER_BACKGROUND_LOAD_MESSAGE);
        return true;
      }

      if (fetchError) {
        console.error("[useOperationCenter] refresh failed:", fetchError, {
          status: res.status,
          timedOut,
        });
        setError(fetchError ?? "Erro ao carregar Operation Center.");
        setDashboard(emptyOperationDashboard());
        return false;
      }

      if (!res.ok) {
        const message = data?.error ?? `Erro ao carregar Operation Center (${res.status}).`;
        console.error("[useOperationCenter] API error:", message, { status: res.status });
        setError(message);
        setDashboard(data?.dashboard ?? emptyOperationDashboard());
        return false;
      }

      setDashboard(data?.dashboard ?? emptyOperationDashboard());
      if (data?.error) {
        console.warn("[useOperationCenter] API warning:", data.error);
      }
      return false;
    } catch (err) {
      console.error("[useOperationCenter] unexpected error:", err);
      setError("Erro de conexão.");
      setDashboard(emptyOperationDashboard());
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncState = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch("/api/operation-center/sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: OperationCenterDashboard;
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao sincronizar Operation Center.");
        return false;
      }

      setDashboard(data?.dashboard ?? emptyOperationDashboard());
      return true;
    } catch (err) {
      console.error("[useOperationCenter] syncState failed:", err);
      setError("Erro de conexão.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshInBackground = useCallback(async () => {
    setBackgroundLoading(true);
    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        dashboard?: OperationCenterDashboard;
        error?: string;
      }>("/api/operation-center");

      if (fetchError || timedOut || !res.ok) {
        console.warn("[useOperationCenter] background refresh failed:", fetchError, {
          status: res.status,
          timedOut,
        });
        return;
      }

      setDashboard(data?.dashboard ?? emptyOperationDashboard());
      setError((current) =>
        current === OPERATION_CENTER_BACKGROUND_LOAD_MESSAGE ? null : current
      );
    } catch (err) {
      console.warn("[useOperationCenter] background refresh unexpected error:", err);
    } finally {
      setBackgroundLoading(false);
    }
  }, []);

  useMountFetch(() => {
    void (async () => {
      const timedOut = await refresh();
      if (timedOut) {
        await refreshInBackground();
      }
    })();
  }, [refresh, refreshInBackground]);

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

  async function generateCopy() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/operation-center/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        operation?: OperationCenter;
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao gerar copy." };
      }

      await refresh();
      return { message: data?.message ?? "Copy gerada.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] generateCopy failed:", err);
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

  async function generateCreative(assetType: CreativeAssetType) {
    const operationId = dashboard?.operation?.id;
    const productId = dashboard?.operation?.product_id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/creative-factory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_type: assetType,
          operation_id: operationId,
          product_id: productId,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao gerar criativo." };
      }

      await refresh();
      return { message: data?.message ?? "Criativo gerado.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] generateCreative failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function generateCreativePackage() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/creative-director/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation_id: operationId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return {
          message: null,
          error: data?.error ?? parseError ?? "Erro ao gerar pacote criativo.",
        };
      }

      await refresh();
      return { message: data?.message ?? "Pacote criativo gerado.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] generateCreativePackage failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function downloadCreativePackage() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    const delivered = dashboard?.creativeDirector?.generatedAssets?.filter(
      (asset) => asset.status === "delivered"
    );
    if (!delivered?.length) {
      return { message: null, error: "Nenhuma imagem real entregue para download." };
    }

    setBusy(true);
    try {
      for (const asset of delivered) {
        window.open(asset.download_url, "_blank");
      }
      return {
        message: `${delivered.length} imagem(ns) aberta(s) para download.`,
        error: null,
      };
    } catch (err) {
      console.error("[useOperationCenter] downloadCreativePackage failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function downloadCreatives() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa.", count: 0 };

    const delivered = dashboard?.creativeDirector?.generatedAssets?.filter(
      (asset) => asset.status === "delivered"
    );
    if (delivered?.length) {
      setBusy(true);
      try {
        for (const asset of delivered) {
          window.open(asset.download_url, "_blank");
        }
        return {
          message: `${delivered.length} imagem(ns) aberta(s) para download.`,
          error: null,
          count: delivered.length,
        };
      } catch (err) {
        console.error("[useOperationCenter] downloadCreatives failed:", err);
        return { message: null, error: "Erro de conexão.", count: 0 };
      } finally {
        setBusy(false);
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/creative-factory?operationId=${encodeURIComponent(operationId)}`);
      const { data, error: parseError } = await parseJsonResponse<{
        assets?: { id: string; title?: string | null; status: string }[];
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return {
          message: null,
          error: data?.error ?? parseError ?? "Erro ao listar criativos.",
          count: 0,
        };
      }

      const readyAssets = (data?.assets ?? []).filter((a) => a.status === "ready");
      if (readyAssets.length === 0) {
        return { message: null, error: "Nenhum criativo pronto para download.", count: 0 };
      }

      for (const asset of readyAssets) {
        window.open(`/api/creative-factory/download/${asset.id}`, "_blank");
      }

      return {
        message: `${readyAssets.length} arquivo(s) aberto(s) para download.`,
        error: null,
        count: readyAssets.length,
      };
    } catch (err) {
      console.error("[useOperationCenter] downloadCreatives failed:", err);
      return { message: null, error: "Erro de conexão.", count: 0 };
    } finally {
      setBusy(false);
    }
  }

  async function generateLandingReal() {
    const operationId = dashboard?.operation?.id;
    if (!operationId) return { message: null, error: "Nenhuma operação ativa." };

    setBusy(true);
    try {
      const res = await fetch("/api/landing-factory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_id: operationId,
          product_id: dashboard?.operation?.product_id,
          copylab_id: dashboard?.operation?.copylab_id,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return {
          message: null,
          error: data?.error ?? parseError ?? "Erro ao gerar landing real.",
        };
      }

      await refresh();
      return { message: data?.message ?? "Landing real gerada.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] generateLandingReal failed:", err);
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function publishLanding() {
    const landingId = dashboard?.landingPage?.id;
    if (!landingId) return { message: null, error: "Nenhuma landing vinculada." };

    setBusy(true);
    try {
      const res = await fetch("/api/landing-factory/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landingId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao publicar landing." };
      }

      await refresh();
      return { message: data?.message ?? "Landing publicada.", error: data?.error ?? null };
    } catch (err) {
      console.error("[useOperationCenter] publishLanding failed:", err);
      return { message: null, error: "Erro de conexão." };
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
    backgroundLoading,
    error,
    busy,
    refresh,
    syncState,
    generateCopy,
    generateAssets,
    generateCreative,
    generateCreativePackage,
    downloadCreatives,
    downloadCreativePackage,
    generateLandingReal,
    publishLanding,
    prepareCampaign,
    sendToPerformanceAi,
    approveOperation,
    cancelOperation,
  };
}
