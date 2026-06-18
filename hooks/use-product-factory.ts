"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductComplianceCheck, ProductFile } from "@/types/database";
import type {
  ProductFactoryBundle,
  ProductFactoryDashboardMetrics,
  ProductFactoryIntake,
} from "@/utils/product-factory";
import type { ProductFactoryProAction } from "@/utils/product-factory-pro";
import { parseJsonResponse } from "@/utils/safe-json";

export function useProductFactory() {
  const [dashboard, setDashboard] = useState<ProductFactoryDashboardMetrics | null>(null);
  const [bundles, setBundles] = useState<ProductFactoryBundle[]>([]);
  const [storageReady, setStorageReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/factory");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ProductFactoryDashboardMetrics;
        bundles?: ProductFactoryBundle[];
        storageReady?: boolean;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Product Factory.");
        setDashboard(null);
        setBundles([]);
        setStorageReady(false);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setBundles(data.bundles ?? []);
      setStorageReady(data.storageReady ?? true);
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

  async function generate(input: ProductFactoryIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/factory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: ProductFactoryBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro ao gerar e-book." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function publishPdf(factoryId: string, pdfBase64: string, premium = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/factory/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factory_id: factoryId,
          pdf_base64: pdfBase64,
          premium,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        file?: ProductFile;
        bundle?: ProductFactoryBundle;
        error?: string;
        qualityScore?: number;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.file) {
        return {
          file: null,
          error: data?.error ?? parseError ?? "Erro ao publicar PDF.",
          qualityScore: data?.qualityScore,
        };
      }

      await refresh();
      return { file: data.file, error: null, qualityScore: data.qualityScore };
    } catch {
      return { file: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function runProAction(factoryId: string, action: ProductFactoryProAction) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/factory/pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factory_id: factoryId, action }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        bundle?: ProductFactoryBundle;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.bundle) {
        return { bundle: null, error: data?.error ?? parseError ?? "Erro na ação Pro." };
      }

      await refresh();
      return { bundle: data.bundle, error: null };
    } catch {
      return { bundle: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function runCompliance(factoryId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/factory/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factory_id: factoryId,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        compliance?: ProductComplianceCheck;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.compliance) {
        return { compliance: null, error: data?.error ?? parseError ?? "Erro na análise." };
      }

      await refresh();
      return { compliance: data.compliance, error: null };
    } catch {
      return { compliance: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/factory?id=${encodeURIComponent(id)}`, {
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
    storageReady,
    loading,
    error,
    busy,
    refresh,
    generate,
    publishPdf,
    runProAction,
    runCompliance,
    removeRecord,
  };
}
