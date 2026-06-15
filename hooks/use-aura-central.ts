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

export function useAuraCentral({ displayName }: UseAuraCentralOptions) {
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [openingMessage, setOpeningMessage] = useState<AuraCentralMessage | null>(null);
  const [commandHistory, setCommandHistory] = useState<AuraCommandHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fallbackMessage = useCallback((): AuraCentralMessage => {
    return {
      role: "assistant",
      text: `Olá, ${displayName}. Sou a Aura Central — converse naturalmente e eu executo ações nos módulos (calendário, vendas, financeiro, saúde, Alvesz).`,
      module: "global",
    };
  }, [displayName]);

  const loadCommandHistory = useCallback(async () => {
    try {
      const { res, data, error: fetchError, timedOut } = await fetchJsonWithTimeout<{
        entries?: AuraCommandHistoryEntry[];
        error?: string;
      }>("/api/aura-central?history=1");

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
    }
  }, []);

  const loadOpening = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const [summaryResult] = await Promise.all([
        fetchJsonWithTimeout<{ text?: string; error?: string }>("/api/aura-central"),
        loadCommandHistory(),
      ]);

      const { res, data, error: fetchError, timedOut } = summaryResult;

      if (fetchError || timedOut || !res.ok) {
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
  }, [displayName, fallbackMessage, loadCommandHistory]);

  useEffect(() => {
    void loadOpening();
  }, [loadOpening]);

  return {
    summaryLoading,
    openingMessage,
    commandHistory,
    historyError,
    reloadHistory: loadCommandHistory,
    reloadOpening: loadOpening,
  };
}
