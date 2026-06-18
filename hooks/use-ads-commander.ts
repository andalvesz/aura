"use client";

import { useCallback, useState } from "react";
import type { AdsCommanderDashboard } from "@/utils/ads-commander";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useAdsCommander() {
  const [dashboard, setDashboard] = useState<AdsCommanderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ads-commander");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: AdsCommanderDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Ads Commander.");
        setDashboard(null);
        return;
      }

      setDashboard(data?.dashboard ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(refresh, [refresh]);

  async function prepareCampaign(params?: {
    operationId?: string;
    platform?: "meta" | "google" | "tiktok" | "other";
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/ads-commander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          operationId: params?.operationId,
          platform: params?.platform ?? "meta",
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao preparar campanha." };
      }

      await refresh();
      return { message: data?.message ?? "Campanha preparada.", error: data?.error ?? null };
    } catch {
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function approveCampaign(campaignId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ads-commander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", campaignId }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao aprovar campanha." };
      }

      await refresh();
      return { message: data?.message ?? "Campanha aprovada.", error: data?.error ?? null };
    } catch {
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  async function publishCampaign(campaignId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ads-commander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          campaignId,
          explicitApproval: true,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { message: null, error: data?.error ?? parseError ?? "Erro ao publicar campanha." };
      }

      await refresh();
      return { message: data?.message ?? "Campanha publicada.", error: data?.error ?? null };
    } catch {
      return { message: null, error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return { dashboard, loading, error, busy, refresh, prepareCampaign, approveCampaign, publishCampaign };
}
