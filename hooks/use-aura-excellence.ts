"use client";

import { useCallback, useState } from "react";
import type { QualityReview, QualityScore } from "@/types/database";
import type { ExcellenceDashboard, ExcellenceReviewResult } from "@/utils/aura-excellence";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useAuraExcellence() {
  const [dashboard, setDashboard] = useState<ExcellenceDashboard | null>(null);
  const [scores, setScores] = useState<QualityScore[]>([]);
  const [reviews, setReviews] = useState<QualityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aura-excellence");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ExcellenceDashboard;
        scores?: QualityScore[];
        reviews?: QualityReview[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Excellence Engine.");
        setDashboard(null);
        setScores([]);
        setReviews([]);
        return;
      }

      setDashboard(data.dashboard ?? null);
      setScores(data.scores ?? []);
      setReviews(data.reviews ?? []);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
      setScores([]);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const review = useCallback(
    async (input: {
      asset_type: string;
      asset_id: string;
      content?: string;
      label?: string;
      force_refresh?: boolean;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/aura-excellence/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "review", ...input }),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          result?: ExcellenceReviewResult;
          error?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao auditar ativo.");
          return null;
        }

        await refresh();
        return data?.result ?? null;
      } catch {
        setError("Erro de conexão.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const approve = useCallback(
    async (assetType: string, assetId: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/aura-excellence/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", asset_type: assetType, asset_id: assetId }),
        });
        const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao aprovar ativo.");
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

  const reject = useCallback(
    async (assetType: string, assetId: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/aura-excellence/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject", asset_type: assetType, asset_id: assetId }),
        });
        const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);
        if (parseError || !res.ok || data?.error) {
          setError(data?.error ?? parseError ?? "Erro ao reprovar ativo.");
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

  return { dashboard, scores, reviews, loading, error, busy, refresh, review, approve, reject };
}
