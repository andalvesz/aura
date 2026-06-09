"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorAdsCampaign, CreatorAsset, CreatorLanding } from "@/types/database";
import type { AdsDashboardMetrics, AdsIntake } from "@/utils/ads-manager";
import { parseJsonResponse } from "@/utils/safe-json";

export function useAdsManager() {
  const [dashboard, setDashboard] = useState<AdsDashboardMetrics | null>(null);
  const [records, setRecords] = useState<CreatorAdsCampaign[]>([]);
  const [assets, setAssets] = useState<CreatorAsset[]>([]);
  const [landings, setLandings] = useState<CreatorLanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/ads");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: AdsDashboardMetrics;
        records?: CreatorAdsCampaign[];
        assets?: CreatorAsset[];
        landings?: CreatorLanding[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar campanhas.");
        setDashboard(null);
        setRecords([]);
        setAssets([]);
        setLandings([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setRecords(data.records ?? []);
      setAssets(data.assets ?? []);
      setLandings(data.landings ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setRecords([]);
      setAssets([]);
      setLandings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generate(input: AdsIntake) {
    setBusy(true);
    try {
      const res = await fetch("/api/creator/ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        record?: CreatorAdsCampaign;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error || !data.record) {
        return { record: null, error: data?.error ?? parseError ?? "Erro ao gerar campanha." };
      }

      await refresh();
      return { record: data.record, error: null };
    } catch {
      return { record: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/creator/ads?id=${encodeURIComponent(id)}`, {
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
    records,
    assets,
    landings,
    loading,
    error,
    busy,
    refresh,
    generate,
    removeRecord,
  };
}
