"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuraCommandHistoryEntry } from "@/utils/aura-commands";
import type { AuraCentralModule } from "@/utils/orchestrator";
import { fetchJsonWithTimeout } from "@/utils/fetch-json";

export type AuraCentralMessage = {
  role: "user" | "assistant";
  text: string;
  module?: AuraCentralModule;
};

type UseAuraCentralOptions = {
  displayName: string;
};

export const AURA_CENTRAL_INITIAL_LOAD_TIMEOUT_MS = 8_000;
export const AURA_CENTRAL_BACKGROUND_LOAD_MESSAGE =
  "Alguns dados ainda estão carregando em segundo plano.";

export function useAuraCentral({ displayName }: UseAuraCentralOptions) {
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [openingMessage, setOpeningMessage] = useState<AuraCentralMessage | null>(null);
  const [commandHistory, setCommandHistory] = useState<AuraCommandHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);

  const fallbackMessage = useCallback((): AuraCentralMessage => {
    return {
      role: "assistant",
      text: `Olá, ${displayName}. Sou a Aura Central — converse naturalmente e eu executo ações nos módulos (calendário, vendas, financeiro, saúde, Alvesz).`,
      module: "global",
    };
  }, [displayName]);

  const loadCommandHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        entries?: AuraCommandHistoryEntry[];
        error?: string;
      }>("/api/aura-central?history=1", {
        timeoutMs: AURA_CENTRAL_INITIAL_LOAD_TIMEOUT_MS,
      });

      if (fetchError || timedOut || !res.ok) {
        console.warn("[useAuraCentral] history failed:", fetchError ?? data?.error, {
          status: res.status,
          timedOut,
        });
        setHistoryError(fetchError ?? data?.error ?? "Histórico indisponível.");
        setCommandHistory([]);
        return;
      }

      setHistoryError(null);
      setCommandHistory(data?.entries ?? []);
    } catch (err) {
      console.warn("[useAuraCentral] history unexpected error:", err);
      setHistoryError("Histórico indisponível.");
      setCommandHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadOpening = useCallback(async () => {
    setSummaryLoading(true);
    setBackgroundNotice(null);

    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        text?: string;
        error?: string;
      }>("/api/aura-central", {
        timeoutMs: AURA_CENTRAL_INITIAL_LOAD_TIMEOUT_MS,
      });

      if (timedOut) {
        console.warn("[useAuraCentral] summary timed out");
        setOpeningMessage(fallbackMessage());
        setBackgroundNotice(AURA_CENTRAL_BACKGROUND_LOAD_MESSAGE);
        return;
      }

      if (fetchError || !res.ok) {
        console.warn("[useAuraCentral] summary failed:", fetchError ?? data?.error, {
          status: res.status,
          timedOut,
        });
        setOpeningMessage(fallbackMessage());
        return;
      }

      setOpeningMessage({
        role: "assistant",
        text:
          data?.text ??
          `Olá, ${displayName}. Central de Comandos ativa — peça para registrar despesas, criar eventos, leads, treinos e mais.`,
        module: "global",
      });
    } catch (err) {
      console.error("[useAuraCentral] loadOpening failed:", err);
      setOpeningMessage(fallbackMessage());
    } finally {
      setSummaryLoading(false);
    }
  }, [displayName, fallbackMessage]);

  useEffect(() => {
    void loadOpening();
  }, [loadOpening]);

  useEffect(() => {
    void loadCommandHistory();
  }, [loadCommandHistory]);

  return {
    summaryLoading,
    openingMessage,
    commandHistory,
    historyLoading,
    historyError,
    backgroundNotice,
    reloadHistory: loadCommandHistory,
    reloadOpening: loadOpening,
  };
}
