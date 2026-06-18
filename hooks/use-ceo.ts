"use client";

import { useCallback, useState } from "react";
import type { AuraCeoSession } from "@/types/database";
import {
  emptyCeoDashboard,
  emptyCeoRadar,
  type CeoDashboardMetrics,
  type CeoOpportunityRadar,
} from "@/utils/ceo";
import type { OperationCenterDashboard } from "@/utils/operation-center";
import { fetchJsonWithTimeout } from "@/utils/fetch-json";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export const CEO_INITIAL_LOAD_TIMEOUT_MS = 8_000;
export const CEO_BACKGROUND_LOAD_MESSAGE =
  "Alguns dados ainda estão carregando em segundo plano.";

type CeoApiPayload = {
  dashboard?: CeoDashboardMetrics;
  session?: AuraCeoSession;
  radar?: CeoOpportunityRadar;
  sessions?: AuraCeoSession[];
  error?: string;
};

function applyCeoPayload(
  data: CeoApiPayload | null | undefined,
  setters: {
    setDashboard: (value: CeoDashboardMetrics) => void;
    setSession: (value: AuraCeoSession | null) => void;
    setRadar: (value: CeoOpportunityRadar) => void;
    setSessions: (value: AuraCeoSession[]) => void;
  }
) {
  setters.setDashboard(data?.dashboard ?? emptyCeoDashboard());
  setters.setSession(data?.session ?? null);
  setters.setRadar(data?.radar ?? emptyCeoRadar());
  setters.setSessions(data?.sessions ?? []);
}

export function useCeo() {
  const [dashboard, setDashboard] = useState<CeoDashboardMetrics | null>(null);
  const [session, setSession] = useState<AuraCeoSession | null>(null);
  const [radar, setRadar] = useState<CeoOpportunityRadar | null>(null);
  const [sessions, setSessions] = useState<AuraCeoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setters = {
    setDashboard: (value: CeoDashboardMetrics) => setDashboard(value),
    setSession,
    setRadar: (value: CeoOpportunityRadar) => setRadar(value),
    setSessions,
  };

  const loadFullDataInBackground = useCallback(async () => {
    setBackgroundLoading(true);
    try {
      const { res, data, error: fetchError, timedOut } =
        await fetchJsonWithTimeout<CeoApiPayload>("/api/ceo?full=1");

      if (fetchError || timedOut || !res.ok || data?.error) {
        console.warn("[useCeo] background load failed:", fetchError ?? data?.error, {
          status: res.status,
          timedOut,
        });
        return;
      }

      applyCeoPayload(data, setters);
      setError((current) =>
        current === CEO_BACKGROUND_LOAD_MESSAGE ? null : current
      );
    } catch (err) {
      console.warn("[useCeo] background load unexpected error:", err);
    } finally {
      setBackgroundLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { res, data, error: fetchError, timedOut } =
        await fetchJsonWithTimeout<CeoApiPayload>("/api/ceo", {
          timeoutMs: CEO_INITIAL_LOAD_TIMEOUT_MS,
        });

      if (timedOut) {
        console.warn("[useCeo] essential load timed out");
        applyCeoPayload(null, setters);
        setError(CEO_BACKGROUND_LOAD_MESSAGE);
        return;
      }

      if (fetchError) {
        console.error("[useCeo] refresh failed:", fetchError, { status: res.status });
        applyCeoPayload(null, setters);
        setError(fetchError);
        return;
      }

      if (!res.ok || data?.error) {
        const message = data?.error ?? `Erro ao carregar Aura CEO (${res.status}).`;
        console.error("[useCeo] API error:", message, { status: res.status });
        applyCeoPayload(data, setters);
        setError(message);
        return;
      }

      applyCeoPayload(data, setters);
    } catch (err) {
      console.error("[useCeo] unexpected error:", err);
      applyCeoPayload(null, setters);
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }

    void loadFullDataInBackground();
  }, [loadFullDataInBackground]);

  useMountFetch(refresh, [refresh]);

  async function createPlan(pergunta: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ceo/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        kind?: "plan" | "operation";
        session?: AuraCeoSession;
        radar?: CeoOpportunityRadar;
        dashboard?: OperationCenterDashboard;
        message?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data) {
        return {
          kind: "error" as const,
          session: null,
          dashboard: null,
          message: null,
          error: parseError ?? "Erro ao processar solicitação.",
        };
      }

      if (data.kind === "operation" && data.dashboard) {
        return {
          kind: "operation" as const,
          session: null,
          dashboard: data.dashboard,
          message: data.message ?? "Etapa operacional executada.",
          error: data.error ?? null,
        };
      }

      if (data.error) {
        return {
          kind: "error" as const,
          session: null,
          dashboard: null,
          message: null,
          error: data.error,
        };
      }

      if (!data.session) {
        return {
          kind: "error" as const,
          session: null,
          dashboard: null,
          message: null,
          error: "Erro ao gerar plano.",
        };
      }

      await refresh();
      return {
        kind: "plan" as const,
        session: data.session,
        dashboard: null,
        message: null,
        error: null,
      };
    } catch (err) {
      console.error("[useCeo] createPlan failed:", err);
      return {
        kind: "error" as const,
        session: null,
        dashboard: null,
        message: null,
        error: "Erro de conexão.",
      };
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ceo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao excluir." };
      }

      await refresh();
      return { error: null };
    } catch (err) {
      console.error("[useCeo] removeSession failed:", err);
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    dashboard,
    session,
    radar,
    sessions,
    loading,
    backgroundLoading,
    error,
    busy,
    refresh,
    createPlan,
    removeSession,
  };
}
