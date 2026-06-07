"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goal } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";

export function useGoals() {
  const [data, setData] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (sync = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals?sync=${sync ? "true" : "false"}`);
      const { data: payload, error: parseError } = await parseJsonResponse<{
        goals?: Goal[];
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(payload?.error ?? parseError ?? "Erro ao carregar metas.");
        setData([]);
        return;
      }

      setData(payload?.goals ?? []);
    } catch {
      setError("Falha ao carregar metas.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (payload: {
      titulo: string;
      tipo: Goal["tipo"];
      meta: number;
      data_inicio: string;
      data_fim: string;
      atual?: number;
    }) => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { data: body, error: parseError } = await parseJsonResponse<{
        goal?: Goal;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return { error: body?.error ?? parseError ?? "Erro ao criar meta." };
      }

      await refresh();
      return { error: null, goal: body?.goal ?? null };
    },
    [refresh]
  );

  return { data, loading, error, refresh, create };
}
