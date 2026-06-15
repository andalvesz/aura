"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MetaAd,
  MetaAdSet,
  MetaBusinessManager,
  MetaPage,
  MetaPixel,
} from "@/lib/meta/meta.client";
import type {
  MetaAdAccount,
  MetaCampaign,
  MetaCampaignMetric,
  MetaConnection,
} from "@/types/database";
import type { MetaIntelligenceMetrics } from "@/utils/meta-intelligence";
import { parseJsonResponse } from "@/utils/safe-json";

export function useMetaConnect() {
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, MetaCampaignMetric>>({});
  const [businessManagers, setBusinessManagers] = useState<MetaBusinessManager[]>([]);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [pixels, setPixels] = useState<MetaPixel[]>([]);
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [metrics, setMetrics] = useState<MetaIntelligenceMetrics | null>(null);
  const [readOnly, setReadOnly] = useState(true);
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
        businessManagers?: MetaBusinessManager[];
        pages?: MetaPage[];
        pixels?: MetaPixel[];
        adSets?: MetaAdSet[];
        ads?: MetaAd[];
        metrics?: MetaIntelligenceMetrics;
        readOnly?: boolean;
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
      setBusinessManagers(data.businessManagers ?? []);
      setPages(data.pages ?? []);
      setPixels(data.pixels ?? []);
      setAdSets(data.adSets ?? []);
      setAds(data.ads ?? []);
      setMetrics(data.metrics ?? null);
      setReadOnly(data.readOnly ?? true);
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

  function connectOAuth() {
    window.location.href = "/api/meta/login";
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

  return {
    connection,
    adAccounts,
    campaigns,
    metricsMap,
    businessManagers,
    pages,
    pixels,
    adSets,
    ads,
    metrics,
    readOnly,
    activeCampaigns,
    pausedCampaigns,
    loading,
    error,
    busy,
    refresh,
    connect,
    connectOAuth,
    disconnect,
    sync,
  };
}
