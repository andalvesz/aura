"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  KiwifyCommission,
  KiwifyConnection,
  KiwifyProduct,
  KiwifySale,
} from "@/types/database";
import type {
  KiwifyIntelligenceMetrics,
  KiwifyPerformanceInsight,
} from "@/utils/kiwify-intelligence";
import { parseJsonResponse } from "@/utils/safe-json";
import { INTEGRATION_SYNC_INTERVAL_MS } from "@/utils/integrations";

export function useKiwifyConnect() {
  const [connection, setConnection] = useState<KiwifyConnection | null>(null);
  const [products, setProducts] = useState<KiwifyProduct[]>([]);
  const [sales, setSales] = useState<KiwifySale[]>([]);
  const [commissions, setCommissions] = useState<KiwifyCommission[]>([]);
  const [revenueTotalCents, setRevenueTotalCents] = useState(0);
  const [commissionsTotalCents, setCommissionsTotalCents] = useState(0);
  const [topAffiliateProducts, setTopAffiliateProducts] = useState<KiwifyProduct[]>([]);
  const [metrics, setMetrics] = useState<KiwifyIntelligenceMetrics | null>(null);
  const [insights, setInsights] = useState<KiwifyPerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kiwify");
      const { data, error: parseError } = await parseJsonResponse<{
        connection?: KiwifyConnection | null;
        products?: KiwifyProduct[];
        sales?: KiwifySale[];
        commissions?: KiwifyCommission[];
        revenueTotalCents?: number;
        commissionsTotalCents?: number;
        topAffiliateProducts?: KiwifyProduct[];
        metrics?: KiwifyIntelligenceMetrics;
        insights?: KiwifyPerformanceInsight[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Kiwify.");
        return;
      }

      setConnection(data.connection ?? null);
      setProducts(data.products ?? []);
      setSales(data.sales ?? []);
      setCommissions(data.commissions ?? []);
      setRevenueTotalCents(data.revenueTotalCents ?? 0);
      setCommissionsTotalCents(data.commissionsTotalCents ?? 0);
      setTopAffiliateProducts(data.topAffiliateProducts ?? []);
      setMetrics(data.metrics ?? null);
      setInsights(data.insights ?? []);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(input: {
    clientId: string;
    clientSecret: string;
    accountId: string;
    accountLabel?: string;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/kiwify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
      if (parseError || !res.ok) return data?.error ?? parseError ?? "Erro ao conectar.";
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/kiwify/connect", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/kiwify/sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
      if (parseError || !res.ok) return data?.error ?? parseError ?? "Erro ao sincronizar.";
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setBusy(true);
    try {
      const res = await fetch("/api/kiwify/intelligence", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
      if (parseError || !res.ok) return data?.error ?? parseError ?? "Erro na análise.";
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    connection,
    products,
    sales,
    commissions,
    revenueTotalCents,
    commissionsTotalCents,
    topAffiliateProducts,
    metrics,
    insights,
    syncIntervalHours: INTEGRATION_SYNC_INTERVAL_MS / (60 * 60 * 1000),
    loading,
    error,
    busy,
    refresh,
    connect,
    disconnect,
    sync,
    analyze,
  };
}
