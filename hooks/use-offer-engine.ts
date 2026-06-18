"use client";

import { useCallback, useState } from "react";
import type { OfferEngineDashboard, OfferEngineIntake, OfferStackBundle } from "@/utils/offer-engine";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useOfferEngine() {
  const [dashboard, setDashboard] = useState<OfferEngineDashboard | null>(null);
  const [stacks, setStacks] = useState<OfferStackBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/offer-engine");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: OfferEngineDashboard;
        stacks?: OfferStackBundle[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Offer Engine.");
        setDashboard(null);
        setStacks([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setStacks(data.stacks ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setStacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback(
    async (input: OfferEngineIntake) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/offer-engine/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          bundle?: OfferStackBundle;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao gerar stack de ofertas.");
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

  return { dashboard, stacks, loading, error, busy, refresh, generate };
}
