"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreatorDashboardMetrics,
  CreatorProductBundle,
  CreatorProductIntake,
} from "@/utils/creator";
import { parseJsonResponse } from "@/utils/safe-json";

export function useCreator() {
  const [dashboard, setDashboard] = useState<CreatorDashboardMetrics | null>(null);
  const [bundles, setBundles] = useState<CreatorProductBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: CreatorDashboardMetrics;
        bundles?: CreatorProductBundle[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Creator.");
        setDashboard(null);
        setBundles([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setBundles(data.bundles ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setBundles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generateProduct(params: {
    intake: CreatorProductIntake;
    useAuraData: boolean;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: CreatorProductBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro ao gerar produto." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function validateProduct(productId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: CreatorProductBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro ao validar." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function generateOffer(productId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: CreatorProductBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro ao gerar oferta." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(productId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator?id=${encodeURIComponent(productId)}`, {
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
    bundles,
    loading,
    error,
    busy,
    refresh,
    generateProduct,
    validateProduct,
    generateOffer,
    removeProduct,
  };
}
