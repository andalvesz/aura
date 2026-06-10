"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegrationCenterDashboard } from "@/lib/supabase/services/integration-center.service";
import { parseJsonResponse } from "@/utils/safe-json";

export function useIntegrationCenter() {
  const [dashboard, setDashboard] = useState<IntegrationCenterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations");
      const { data, error: parseError } = await parseJsonResponse<
        IntegrationCenterDashboard & { error?: string }
      >(res);

      if (parseError || !res.ok || !data) {
        setError((data as { error?: string })?.error ?? parseError ?? "Erro ao carregar integrações.");
        return;
      }

      setDashboard(data);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function syncAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/sync", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        data?: IntegrationCenterDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        return data?.error ?? parseError ?? "Erro ao sincronizar.";
      }

      if (data?.data) setDashboard(data.data);
      return data?.error ?? null;
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    loading,
    error,
    busy,
    refresh,
    syncAll,
  };
}
