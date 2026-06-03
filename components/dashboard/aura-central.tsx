"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
                "Olá, Anderson. Sou a Aura Central — sua interface única de IA. Pergunte o que fazer hoje, crie treinos, marque reuniões ou analise vendas.",
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
              "Olá, Anderson. Sou a Aura Central — coordeno Calendário, Crescimento, Alvesz, Saúde, Social Media e Financeiro.",
            module: "global",
          },
        ]);
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: "assistant",
              text: "Olá, Anderson. Sou a Aura Central — coordeno todos os módulos da Aura OS.",
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
      <PanelHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-cyan-500/15">
              <Sparkles className="size-3.5 text-cyan-400" />
            </div>
            <div>
              <PanelTitle>Aura Central</PanelTitle>
              <p className="text-[10px] text-zinc-600">
                IA única · Calendário · Crescimento · Alvesz · Saúde · Social · Financeiro
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1 text-[10px] text-zinc-600 sm:flex">
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Mentor</span>
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Agenda</span>
            <span className="rounded border border-white/[0.06] px-1.5 py-0.5">Aura Saúde</span>
          </div>
        </div>
      </PanelHeader>

      <PanelContent className="pt-0">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {AURA_CENTRAL_QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={loading || summaryLoading}
              onClick={() => sendMessage(action.prompt, action.id)}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/20 hover:bg-cyan-500/[0.06] hover:text-cyan-200 disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="mb-3 max-h-[380px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2">
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
                className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "ml-6 bg-white/[0.06] text-zinc-200"
                    : "mr-6 bg-cyan-500/10 text-cyan-50"
                }`}
              >
                {message.role === "assistant" && message.module && (
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-cyan-400/80">
                    {ModuleIcon && <ModuleIcon className="size-3" />}
                    {AURA_CENTRAL_MODULE_LABELS[message.module]}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.text}</p>
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
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
            <CalendarDays className="size-4 shrink-0 text-sky-400" />
            <span className="flex-1 text-[12px] text-zinc-300">
              {pendingEvent.titulo} — {pendingEvent.data} às {pendingEvent.hora}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={confirmEvent}
              className="rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              Confirmar evento
            </button>
            <Link
              href="/dashboard/calendario"
              className="text-[11px] text-sky-400 hover:underline"
            >
              Aura Agenda
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="O que devo fazer hoje? Crie treino, marque reunião, analise vendas..."
            disabled={loading || summaryLoading}
            className="h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={loading || summaryLoading || !input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-white transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
