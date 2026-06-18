"use client";

import { useCallback, useState } from "react";
import type { MasterFlowStatusView } from "@/utils/master-flow";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export function useMasterFlow() {
  const [status, setStatus] = useState<MasterFlowStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow");
      const { data, error: parseError } = await parseJsonResponse<{
        status?: MasterFlowStatusView;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Master Flow.");
        setStatus(null);
        return;
      }

      setStatus(data?.status ?? null);
      if (data?.error) setError(data.error);
    } catch {
      setError("Erro de conexão.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBusiness = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        status?: MasterFlowStatusView;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(data?.error ?? parseError ?? "Erro ao criar negócio.");
        return false;
      }

      setStatus(data?.status ?? null);
      if (data?.error) setError(data.error);
      await refresh();
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  const runNextStep = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", flowId: status?.flow.id }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        status?: MasterFlowStatusView;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(data?.error ?? parseError ?? "Erro ao executar etapa.");
        return false;
      }

      setStatus(data?.status ?? null);
      if (data?.error) setError(data.error);
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setRunning(false);
    }
  }, [status?.flow.id]);

  useMountFetch(refresh, [refresh]);

  return { status, loading, error, running, refresh, createBusiness, runNextStep };
}
