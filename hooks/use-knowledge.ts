"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  KnowledgeEntry,
  KnowledgeInsight,
  KnowledgePattern,
  MarketHistory,
} from "@/types/database";
import type { KnowledgeConnectorStatus, KnowledgeDashboardMetrics } from "@/utils/knowledge";
import { parseJsonResponse } from "@/utils/safe-json";

export function useKnowledge() {
  const [dashboard, setDashboard] = useState<KnowledgeDashboardMetrics | null>(null);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [patterns, setPatterns] = useState<KnowledgePattern[]>([]);
  const [marketHistory, setMarketHistory] = useState<MarketHistory[]>([]);
  const [connectors, setConnectors] = useState<KnowledgeConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: KnowledgeDashboardMetrics;
        entries?: KnowledgeEntry[];
        insights?: KnowledgeInsight[];
        patterns?: KnowledgePattern[];
        marketHistory?: MarketHistory[];
        connectors?: KnowledgeConnectorStatus[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Knowledge & Connect.");
        setDashboard(null);
        setEntries([]);
        setInsights([]);
        setPatterns([]);
        setMarketHistory([]);
        setConnectors([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setEntries(data.entries ?? []);
      setInsights(data.insights ?? []);
      setPatterns(data.patterns ?? []);
      setMarketHistory(data.marketHistory ?? []);
      setConnectors(data.connectors ?? []);
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

  async function syncFromIntegrations() {
    setBusy(true);
    try {
      const res = await fetch("/api/knowledge?action=sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        synced?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao sincronizar." };
      }

      await refresh();
      return { error: null, synced: data?.synced ?? 0 };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function generateInsights() {
    setBusy(true);
    try {
      const res = await fetch("/api/knowledge/analyze", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        count?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao gerar insights." };
      }

      await refresh();
      return { error: null, count: data?.count ?? 0 };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao remover entrada." };
      }

      await refresh();
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function dismissInsight(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge?id=${id}&type=insight`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao dispensar insight." };
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
    entries,
    insights,
    patterns,
    marketHistory,
    connectors,
    loading,
    error,
    busy,
    refresh,
    syncFromIntegrations,
    generateInsights,
    removeEntry,
    dismissInsight,
  };
}
