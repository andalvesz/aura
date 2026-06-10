"use client";

import { useCallback, useEffect, useState } from "react";
import type { AffiliateAnalysis, AffiliateProduct, PlatformSyncLog } from "@/types/database";
import type {
  PlatformConnectionPublic,
  PlatformsDashboardMetrics,
} from "@/utils/platforms";
import type { PlatformAuthType, PlatformId } from "@/lib/platforms/types";
import { parseJsonResponse } from "@/utils/safe-json";

export function usePlatforms() {
  const [dashboard, setDashboard] = useState<PlatformsDashboardMetrics | null>(null);
  const [connections, setConnections] = useState<PlatformConnectionPublic[]>([]);
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [syncLogs, setSyncLogs] = useState<PlatformSyncLog[]>([]);
  const [analyses, setAnalyses] = useState<AffiliateAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platforms");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: PlatformsDashboardMetrics;
        connections?: PlatformConnectionPublic[];
        products?: AffiliateProduct[];
        syncLogs?: PlatformSyncLog[];
        analyses?: AffiliateAnalysis[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Platform Hub.");
        setDashboard(null);
        setConnections([]);
        setProducts([]);
        setSyncLogs([]);
        setAnalyses([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setConnections(data.connections ?? []);
      setProducts(data.products ?? []);
      setSyncLogs(data.syncLogs ?? []);
      setAnalyses(data.analyses ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(params: {
    platform: PlatformId;
    authType: PlatformAuthType;
    credentials: Record<string, string>;
    accountLabel?: string;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/platforms/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        connection?: PlatformConnectionPublic;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.connection) {
        return { error: data?.error ?? parseError ?? "Erro ao conectar plataforma." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function sync(platform?: PlatformId) {
    setBusy(true);
    try {
      const res = await fetch("/api/platforms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(platform ? { platform } : {}),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        logs?: PlatformSyncLog[];
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { error: data?.error ?? parseError ?? "Erro ao sincronizar." };
      }

      await refresh();
      return { error: data?.error ?? null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setBusy(true);
    try {
      const res = await fetch("/api/platforms/analyze", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        analyses?: AffiliateAnalysis[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        return { error: data?.error ?? parseError ?? "Erro ao gerar Score IA." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(platform: PlatformId) {
    setBusy(true);
    try {
      const res = await fetch(`/api/platforms?platform=${platform}`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao desconectar." };
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
    connections,
    products,
    syncLogs,
    analyses,
    loading,
    error,
    busy,
    refresh,
    connect,
    sync,
    analyze,
    disconnect,
  };
}
