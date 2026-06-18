"use client";

import { useCallback, useState } from "react";
import type { CreativeGeneratedAsset } from "@/types/database";
import type { CreativeDirectorRealDashboard, CreativeGeneratedAssetIntake } from "@/utils/creative-generated-assets";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useCreativeDirector() {
  const [dashboard, setDashboard] = useState<CreativeDirectorRealDashboard | null>(null);
  const [assets, setAssets] = useState<CreativeGeneratedAsset[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creative-director");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: CreativeDirectorRealDashboard;
        assets?: CreativeGeneratedAsset[];
        storageReady?: boolean;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Creative Director.");
        setDashboard(null);
        setAssets([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setAssets(data.assets ?? []);
      setStorageReady(Boolean(data.storageReady));
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRealAsset = useCallback(
    async (input: CreativeGeneratedAssetIntake) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/creative-director/assets/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          asset?: CreativeGeneratedAsset;
          message?: string;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao gerar asset real.");
          return { asset: data?.asset ?? null, message: data?.message ?? null, ok: false };
        }

        await refresh();
        return { asset: data?.asset ?? null, message: data?.message ?? null, ok: true };
      } catch {
        setError("Erro de conexão.");
        return { asset: null, message: null, ok: false };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useMountFetch(refresh, [refresh]);

  return {
    dashboard,
    assets,
    storageReady,
    loading,
    error,
    busy,
    refresh,
    generateRealAsset,
  };
}
