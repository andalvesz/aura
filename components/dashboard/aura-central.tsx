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
  Building2,
  CalendarDays,
  Dumbbell,
  Loader2,
  Rocket,
  Send,
  Share2,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useEventos } from "@/hooks/use-eventos";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { ParsedEventoSuggestion } from "@/utils/calendar";
import { eventoPayloadFromSuggestion } from "@/utils/calendar";
import {
  AURA_CENTRAL_MODULE_LABELS,
  AURA_CENTRAL_QUICK_ACTIONS,
  type AuraCentralModule,
} from "@/utils/orchestrator";
import { parseJsonResponse } from "@/utils/safe-json";

type Message = {
  role: "user" | "assistant";
  text: string;
  module?: AuraCentralModule;
  suggestion?: ParsedEventoSuggestion;
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
};

export function AuraCentral() {
  const { displayName } = useDashboardUser();
  const { create: createEvento } = useEventos();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingEvent, setPendingEvent] = useState<ParsedEventoSuggestion | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await fetch("/api/aura-central");
        const { data, error: parseError } = await parseJsonResponse<{
          text?: string;
          error?: string;
        }>(response);

        if (cancelled) return;

        if (parseError || !response.ok) {
          setMessages([
            {
              role: "assistant",
              text:
                parseError ??
                data?.error ??
                `Olá, ${displayName}. Sou a Aura Central — sua interface única de IA. Pergunte o que fazer hoje, crie treinos, marque reuniões ou analise vendas.`,
              module: "global",
            },
          ]);
          return;
        }

        setMessages([
          {
            role: "assistant",
            text:
              data?.text ??
              `Olá, ${displayName}. Sou a Aura Central — coordeno Calendário, Crescimento, Alvesz, Saúde, Social Media e Financeiro.`,
            module: "global",
          },
        ]);
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: "assistant",
              text: `Olá, ${displayName}. Sou a Aura Central — coordeno todos os módulos da Aura OS.`,
              module: "global",
            },
          ]);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    setPendingEvent(null);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    scrollToBottom();

    try {
      const response = await fetch("/api/aura-central", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          ...(actionId ? { actionId } : {}),
        }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
        module?: AuraCentralModule;
        suggestion?: ParsedEventoSuggestion;
        kind?: string;
        coachMode?: string;
        searchResults?: GlobalSearchResult[];
        searchQuery?: string;
        total?: number;
        reportType?: ExecutiveReportType;
        report?: ExecutiveReportPayload;
        analysis?: ExecutiveReportAnalysis;
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

      if (data?.kind === "evento" && data.suggestion) {
        setPendingEvent(data.suggestion);
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data?.text ?? "Não consegui responder agora.",
          module: data?.module ?? "global",
          suggestion: data?.suggestion,
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

  async function confirmEvent() {
    if (!pendingEvent) return;

    setLoading(true);
    try {
      const result = await createEvento(eventoPayloadFromSuggestion(pendingEvent));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPendingEvent(null);
      toast.success("Evento criado no Calendário");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Evento salvo no Calendário. Veja em Aura Agenda ou no módulo Calendário.",
          module: "calendario",
        },
      ]);
    } catch {
      toast.error("Erro ao salvar evento");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
                IA única · Calendário · Crescimento · Alvesz · Saúde · Social · Financeiro
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-zinc-600">
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Coach</span>
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Mentor</span>
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Agenda</span>
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Saúde</span>
          </div>
        </div>
      </PanelHeader>

      <PanelContent className="px-3 pt-0 sm:px-4">
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
              Orquestrando módulos...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {pendingEvent && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-sky-400" />
              <span className="text-[13px] text-zinc-300">
                {pendingEvent.titulo} — {pendingEvent.data} às {pendingEvent.hora}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={confirmEvent}
                className="min-h-11 flex-1 rounded-md bg-sky-500 px-3 py-2 text-[12px] font-medium text-white hover:bg-sky-400 disabled:opacity-50 sm:min-h-0 sm:flex-none sm:px-2.5 sm:py-1 sm:text-[11px]"
              >
                Confirmar evento
              </button>
              <Link
                href="/dashboard/calendario"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-sky-500/20 px-3 text-[12px] text-sky-400 hover:bg-sky-500/10 sm:min-h-0 sm:flex-none sm:border-0 sm:px-0 sm:text-[11px] sm:hover:bg-transparent sm:hover:underline"
              >
                Aura Agenda
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="O que devo fazer hoje?"
            disabled={loading || summaryLoading}
            className="h-11 min-h-11 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none disabled:opacity-50 sm:h-10 sm:text-[13px]"
          />

          <button
            type="submit"
            disabled={loading || summaryLoading || !input.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
