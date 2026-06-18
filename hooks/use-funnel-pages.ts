"use client";

import { useCallback, useState } from "react";
import type { FunnelPagesBundle, FunnelPagesDashboard, FunnelPagesIntake } from "@/utils/funnel-pages";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useFunnelPages() {
  const [dashboard, setDashboard] = useState<FunnelPagesDashboard | null>(null);
  const [bundles, setBundles] = useState<FunnelPagesBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/funnel-pages");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: FunnelPagesDashboard;
        bundles?: FunnelPagesBundle[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Funnel Pages.");
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

  const generate = useCallback(
    async (input: FunnelPagesIntake) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/funnel-pages/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          bundle?: FunnelPagesBundle;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao gerar páginas do funil.");
          return false;
        }

        await refresh();
        return true;
      } catch {
        setError("Erro de conexão.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useMountFetch(refresh, [refresh]);

  return { dashboard, bundles, loading, error, busy, refresh, generate };
}
