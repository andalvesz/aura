"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MetaAdAccount,
  MetaCampaign,
  MetaCampaignMetric,
  MetaConnection,
} from "@/types/database";
import type { MetaCampaignAction } from "@/utils/integrations";
import { parseJsonResponse } from "@/utils/safe-json";

export function useMetaConnect() {
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, MetaCampaignMetric>>({});
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [pausedCampaigns, setPausedCampaigns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta");
      const { data, error: parseError } = await parseJsonResponse<{
        connection?: MetaConnection | null;
        adAccounts?: MetaAdAccount[];
        campaigns?: MetaCampaign[];
        metricsMap?: Record<string, MetaCampaignMetric>;
        activeCampaigns?: number;
        pausedCampaigns?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Meta Connect.");
        return;
      }

      setConnection(data.connection ?? null);
      setAdAccounts(data.adAccounts ?? []);
      setCampaigns(data.campaigns ?? []);
      setMetricsMap(data.metricsMap ?? {});
      setActiveCampaigns(data.activeCampaigns ?? 0);
      setPausedCampaigns(data.pausedCampaigns ?? 0);
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
    accessToken: string;
    businessId?: string;
    businessName?: string;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/meta/connect", {
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
      await fetch("/api/meta/connect", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/meta/sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
      if (parseError || !res.ok) return data?.error ?? parseError ?? "Erro ao sincronizar.";
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runAction(campaignId: string, action: MetaCampaignAction, approved = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action, approved }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        error?: string;
        requiresApproval?: boolean;
      }>(res);
      if (parseError || !res.ok) {
        return {
          error: data?.error ?? parseError ?? "Erro na ação.",
          requiresApproval: data?.requiresApproval ?? false,
        };
      }
      await refresh();
      return { error: null, requiresApproval: false };
    } finally {
      setBusy(false);
    }
  }

  return {
    connection,
    adAccounts,
    campaigns,
    metricsMap,
    activeCampaigns,
    pausedCampaigns,
    loading,
    error,
    busy,
    refresh,
    connect,
    disconnect,
    sync,
    runAction,
  };
}
