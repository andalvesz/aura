"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuraXpState } from "@/lib/supabase/services/xp.service";
import { parseJsonResponse } from "@/utils/safe-json";

export function useAuraXp() {
  const [state, setState] = useState<AuraXpState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/xp", { cache: "no-store" });
      const { data, error: parseError } = await parseJsonResponse<{
        state?: AuraXpState;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(data?.error ?? parseError ?? "Erro ao carregar XP.");
        setState(null);
      } else {
        setState(data?.state ?? null);
      }
    } catch {
      setError("Erro de conexão.");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, error, refresh };
}
