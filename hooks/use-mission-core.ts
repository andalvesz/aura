"use client";

import { useCallback, useState } from "react";
import type { MissionStatus } from "@/utils/mission-core";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

type MissionApiResponse = {
  success?: boolean;
  mission?: MissionStatus | null;
  error?: string | null;
};

export function useMissionCore() {
  const [mission, setMission] = useState<MissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow?action=status");
      const { data, error: parseError } = await parseJsonResponse<MissionApiResponse>(res);

      if (parseError) {
        setError(parseError);
        setMission(null);
        return;
      }

      if (!res.ok && !data?.mission) {
        setError(data?.error ?? "Erro ao carregar missão.");
        setMission(null);
        return;
      }

      setMission(data?.mission ?? null);
      if (data?.error) setError(data.error);
    } catch {
      setError("Erro de conexão.");
      setMission(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const startMission = useCallback(async (intent?: MasterFlowIntentInput) => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", intent }),
      });
      const { data, error: parseError } = await parseJsonResponse<MissionApiResponse>(res);

      if (parseError) {
        setError(parseError);
        return false;
      }

      if (!res.ok && !data?.mission) {
        setError(data?.error ?? "Erro ao criar missão.");
        return false;
      }

      setMission(data?.mission ?? null);
      if (data?.error) setError(data.error);
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setRunning(false);
    }
  }, []);

  const advanceMission = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", flowId: mission?.flow_id }),
      });
      const { data, error: parseError } = await parseJsonResponse<MissionApiResponse>(res);

      if (parseError) {
        setError(parseError);
        return false;
      }

      if (!res.ok && !data?.mission) {
        setError(data?.error ?? "Erro ao continuar missão.");
        return false;
      }

      setMission(data?.mission ?? null);
      if (data?.error) setError(data.error);
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setRunning(false);
    }
  }, [mission?.flow_id]);

  const approveMission = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/master-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", flowId: mission?.flow_id }),
      });
      const { data, error: parseError } = await parseJsonResponse<MissionApiResponse>(res);

      if (parseError) {
        setError(parseError);
        return false;
      }

      if (!res.ok && !data?.mission) {
        setError(data?.error ?? "Erro ao aprovar missão.");
        return false;
      }

      setMission(data?.mission ?? null);
      if (data?.error) setError(data.error);
      return true;
    } catch {
      setError("Erro de conexão.");
      return false;
    } finally {
      setRunning(false);
    }
  }, [mission?.flow_id]);

  useMountFetch(() => refresh(), [refresh]);

  return { mission, loading, error, running, refresh, startMission, advanceMission, approveMission };
}
