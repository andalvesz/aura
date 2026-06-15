"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GlobalSearchResult } from "@/utils/global-search";
import { formatResultDateLabel } from "@/utils/global-search";
import { useDashboardUser } from "@/components/dashboard/dashboard-user-context";
import type {
  ExecutiveReportAnalysis,
  ExecutiveReportPayload,
  ExecutiveReportType,
} from "@/utils/executive-reports";
import {
  AURA_COMMAND_LABELS,
  AURA_COMMAND_MODULE_LABELS,
  type AuraCommandHistoryEntry,
  type PendingAuraCommand,
} from "@/utils/aura-commands";
import {
  Building2,
  CalendarDays,
  Check,
  Dumbbell,
  History,
  Languages,
  Loader2,
  Rocket,
  Send,
  Share2,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  AURA_CENTRAL_MODULE_LABELS,
  AURA_CENTRAL_QUICK_ACTIONS,
  type AuraCentralModule,
} from "@/utils/orchestrator";
import { parseJsonResponse } from "@/utils/safe-json";
import { isValidDate } from "@/utils/format";
import { useAuraCentral } from "@/hooks/use-aura-central";

type Message = {
  role: "user" | "assistant";
  text: string;
  module?: AuraCentralModule;
  kind?: string;
  coachMode?: string;
  searchResults?: GlobalSearchResult[];
  searchQuery?: string;
  searchTotal?: number;
  reportType?: ExecutiveReportType;
  report?: ExecutiveReportPayload;
  analysis?: ExecutiveReportAnalysis;
};

const MODULE_ICONS: Record<AuraCentralModule, React.ComponentType<{ className?: string }>> = {
  global: Sparkles,
  calendario: CalendarDays,
  crescimento: Rocket,
  alvesz: Building2,
  saude: Dumbbell,
  "social-media": Share2,
  financeiro: Wallet,
  idiomas: Languages,
};

function formatHistoryTime(iso: string) {
  if (!isValidDate(iso)) return "Data não definida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "Data não definida";
  }
}

export function AuraCentral() {
  const { displayName } = useDashboardUser();
  const {
    summaryLoading,
    openingMessage,
    commandHistory,
    reloadHistory,
  } = useAuraCentral({ displayName });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCommand, setPendingCommand] = useState<PendingAuraCommand | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openingMessage && messages.length === 0 && !summaryLoading) {
      setMessages([openingMessage]);
    }
  }, [openingMessage, messages.length, summaryLoading]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendMessage(text: string, actionId?: string, options?: { confirm?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed && !options?.confirm) return;
    if (loading) return;

    setInput("");
    setLoading(true);

    if (!options?.confirm) {
      setPendingCommand(null);
    }

    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    if (!options?.confirm) {
      setMessages((current) => [...current, { role: "user", text: trimmed || "Confirmar" }]);
    }
    scrollToBottom();

    try {
      const response = await fetch("/api/aura-central", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed || "confirmar",
          history,
          ...(actionId ? { actionId } : {}),
          ...(pendingCommand && options?.confirm
            ? { pendingCommand, confirm: true }
            : {}),
        }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
        module?: AuraCentralModule;
        kind?: string;
        coachMode?: string;
        searchResults?: GlobalSearchResult[];
        searchQuery?: string;
        total?: number;
        reportType?: ExecutiveReportType;
        report?: ExecutiveReportPayload;
        analysis?: ExecutiveReportAnalysis;
        pendingCommand?: PendingAuraCommand | null;
        executed?: boolean;
      }>(response);

      if (parseError || !response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: parseError ?? data?.error ?? "Não consegui responder agora.",
            module: "global",
          },
        ]);
        return;
      }

      if (data?.kind === "command") {
        if (data.executed) {
          setPendingCommand(null);
          toast.success("Ação executada");
          await reloadHistory();
        } else if (data.pendingCommand) {
          setPendingCommand(data.pendingCommand);
        }
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data?.text ?? "Não consegui responder agora.",
          module: data?.module ?? "global",
          kind: data?.kind,
          coachMode: data?.coachMode,
          searchResults: data?.searchResults,
          searchQuery: data?.searchQuery,
          searchTotal: data?.total,
          reportType: data?.reportType,
          report: data?.report,
          analysis: data?.analysis,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Erro ao conectar com a Aura Central. Tente novamente.",
          module: "global",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function confirmPendingCommand() {
    if (!pendingCommand) return;
    void sendMessage("confirmar", undefined, { confirm: true });
  }

  function cancelPendingCommand() {
    setPendingCommand(null);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: "Ação cancelada. Pode pedir outra coisa.",
        module: "global",
      },
    ]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pendingCommand && !loading) {
      const lower = input.trim().toLowerCase();
      if (["sim", "confirmar", "ok", "salvar"].includes(lower)) {
        confirmPendingCommand();
        return;
      }
    }
    sendMessage(input);
  }

  return (
    <Panel className="border-cyan-500/10 bg-cyan-500/[0.02]">
      <PanelHeader className="px-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/15 sm:size-7">
              <Sparkles className="size-4 text-cyan-400 sm:size-3.5" />
            </div>
            <div className="min-w-0">
              <PanelTitle>Aura Central</PanelTitle>
              <p className="truncate text-[10px] text-zinc-600 sm:whitespace-normal">
                Central de Comandos · ações reais no Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-2 text-[12px] text-zinc-500 hover:border-cyan-400/20 hover:text-cyan-300 sm:min-h-9 sm:w-auto sm:px-2 sm:py-1 sm:text-[11px]"
          >
            <History className="size-3.5" />
            Histórico ({commandHistory.length})
          </button>
        </div>
      </PanelHeader>

      <PanelContent className="px-3 pt-0 sm:px-4">
        {historyOpen && (
          <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/50 p-2">
            {commandHistory.length === 0 ? (
              <p className="px-2 py-1 text-[12px] text-zinc-600">
                Nenhuma ação executada ainda.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {commandHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md bg-white/[0.02] px-2 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-300">
                        {AURA_COMMAND_LABELS[
                          entry.command_id as keyof typeof AURA_COMMAND_LABELS
                        ] ?? entry.command_id}
                      </span>
                      <span
                        className={
                          entry.status === "success"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {entry.status === "success" ? "OK" : "Erro"}
                      </span>
                    </div>
                    <p className="text-zinc-500">
                      {AURA_COMMAND_MODULE_LABELS[
                        entry.module as keyof typeof AURA_COMMAND_MODULE_LABELS
                      ] ?? entry.module}{" "}
                      · {formatHistoryTime(entry.created_at)}
                    </p>
                    <p className="truncate text-zinc-600">{entry.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {AURA_CENTRAL_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={loading || summaryLoading}
              onClick={() => sendMessage(action.prompt, action.id)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:border-cyan-400/20 hover:bg-cyan-500/[0.06] hover:text-cyan-200 disabled:opacity-50 sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="mb-3 max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2 sm:max-h-[380px]">
          {summaryLoading && messages.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Carregando resumo global...
            </div>
          )}

          {messages.map((message, index) => {
            const ModuleIcon =
              message.module && message.module !== "global"
                ? MODULE_ICONS[message.module]
                : null;

            return (
              <div
                key={index}
                className={`rounded-lg px-3 py-2.5 text-[13px] leading-relaxed sm:py-2 ${
                  message.role === "user"
                    ? "ml-0 bg-white/[0.06] text-zinc-200 sm:ml-6"
                    : "mr-0 bg-cyan-500/10 text-cyan-50 sm:mr-6"
                }`}
              >
                {message.role === "assistant" && message.module && (
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-cyan-400/80">
                    {ModuleIcon && <ModuleIcon className="size-3" />}
                    {message.kind === "coach"
                      ? "Aura Coach"
                      : message.kind === "command"
                        ? "Comando"
                        : AURA_CENTRAL_MODULE_LABELS[message.module]}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.kind === "report" && message.analysis && (
                  <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2 text-[12px] text-zinc-300">
                    <p>
                      <span className="text-cyan-400/80">Funcionou:</span>{" "}
                      {message.analysis.funcionou}
                    </p>
                    <p>
                      <span className="text-cyan-400/80">Ajustar:</span>{" "}
                      {message.analysis.naoFuncionou}
                    </p>
                    <p>
                      <span className="text-cyan-400/80">Prioridade:</span>{" "}
                      {message.analysis.proximaPrioridade}
                    </p>
                  </div>
                )}
                {message.kind === "search" && message.searchResults && (
                  <ul className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
                    {message.searchResults.length === 0 ? (
                      <li className="text-[12px] text-zinc-500">
                        Nenhum resultado encontrado.
                      </li>
                    ) : (
                      message.searchResults.map((item) => (
                        <li key={`${item.entity}-${item.id}`}>
                          <Link
                            href={item.moduleHref}
                            className="block rounded-md bg-white/[0.03] px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
                          >
                            <p className="text-[10px] font-medium text-violet-300/90">
                              [{item.typeLabel}]
                            </p>
                            <p className="text-[12px] font-medium text-zinc-200">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {item.moduleLabel} · {formatResultDateLabel(item.dateIso)}
                            </p>
                          </Link>
                        </li>
                      ))
                    )}
                    {message.searchTotal != null &&
                      message.searchTotal > (message.searchResults?.length ?? 0) && (
                        <li className="text-[10px] text-zinc-600">
                          Use a busca no topo da Aura para ver todos os{" "}
                          {message.searchTotal} resultados
                          {message.searchQuery ? ` de "${message.searchQuery}"` : ""}.
                        </li>
                      )}
                  </ul>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-lg bg-cyan-500/10 px-3 py-2 text-[13px] text-cyan-300">
              <Loader2 className="size-3.5 animate-spin" />
              {pendingCommand ? "Executando ação..." : "Orquestrando módulos..."}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {pendingCommand && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-400/90">
                Confirmar ação ·{" "}
                {AURA_COMMAND_LABELS[pendingCommand.commandId]}
              </p>
              <p className="mt-1 text-[13px] text-zinc-300">{pendingCommand.confirmText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={confirmPendingCommand}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:min-h-0 sm:flex-none"
              >
                <Check className="size-3.5" />
                Confirmar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={cancelPendingCommand}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] px-3 py-2 text-[12px] text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50 sm:min-h-0 sm:flex-none"
              >
                <X className="size-3.5" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingCommand
                ? 'Digite "sim" ou use Confirmar'
                : "Ex.: Adicionar despesa de R$ 50 com gasolina"
            }
            disabled={loading || summaryLoading}
            className="h-11 min-h-11 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none disabled:opacity-50 sm:h-10 sm:text-[13px]"
          />

          <button
            type="submit"
            disabled={loading || summaryLoading || (!input.trim() && !pendingCommand)}
            className="flex size-11 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
