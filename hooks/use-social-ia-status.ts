"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/utils/safe-json";

type SocialIaStatus = {
  available: boolean;
  reason: string | null;
  loading: boolean;
};

export function useSocialIaStatus(): SocialIaStatus {
  const [available, setAvailable] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/social-ia/status");
        const { data, error: parseError } = await parseJsonResponse<{
          available?: boolean;
          reason?: string | null;
        }>(res);

        if (cancelled) return;

        if (parseError || !res.ok) {
          setAvailable(false);
          setReason(
            parseError ?? "Não foi possível verificar a disponibilidade da IA."
          );
        } else {
          setAvailable(Boolean(data?.available));
          setReason(data?.reason ?? null);
        }
      } catch {
        if (!cancelled) {
          setAvailable(false);
          setReason("Não foi possível verificar a disponibilidade da IA.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, reason, loading };
}
