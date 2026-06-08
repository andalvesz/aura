"use client";

import {
  AlertCircle,
  CalendarDays,
  Clapperboard,
  Heart,
  Landmark,
  Loader2,
  Send,
  Sparkles,
  TrendingUp,
  UserCircle,
  Video,
  Wine,
} from "lucide-react";
import { useRef, useState } from "react";
import type { GrowthLead, InstagramMarca } from "@/types/database";
import { parseConteudoSuggestions, type ParsedConteudoSuggestion } from "@/utils/social";
import { parseJsonResponse } from "@/utils/safe-json";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  mode?: "chat" | "calendario" | "ideias" | "roteiro" | "post-hoje" | "coach";
};

const COACH_ACTIONS: QuickAction[] = [
  {
    id: "post-hoje",
    label: "O que postar hoje?",
    icon: Sparkles,
    mode: "post-hoje",
    prompt: "O que devo postar hoje?",
  },
  {
    id: "conteudo-atrasado",
    label: "Conteúdo atrasado?",
    icon: AlertCircle,
    mode: "coach",
    prompt: "Tenho algum conteúdo atrasado?",
  },
  {
    id: "melhor-resultado",
    label: "Melhor resultado",
    icon: TrendingUp,
    mode: "coach",
    prompt: "Qual conteúdo gera mais resultado?",
  },
  {
    id: "gravar-semana",
    label: "Gravar esta semana",
    icon: Video,
    mode: "coach",
    prompt: "Qual conteúdo devo gravar esta semana?",
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "criar-roteiro-reels",
    label: "Roteiro para Reels",
    icon: Clapperboard,
    mode: "roteiro",
    prompt: "Criar roteiro para Reels",
  },
  {
    id: "calendario-semana",
    label: "Calendário da semana",
    icon: CalendarDays,
    mode: "calendario",
    prompt: "Criar calendário da semana",
  },
  {
    id: "ideias-alvesz",
    label: "Ideias Alvesz",
    icon: Wine,
    mode: "ideias",
    prompt: "Ideias para Alvesz Experience",
  },
  {
    id: "ideias-consorcios",
    label: "Ideias consórcios",
    icon: Landmark,
    mode: "ideias",
    prompt: "Ideias para consórcios",
  },
  {
    id: "ideias-marca-pessoal",
    label: "Marca pessoal",
    icon: UserCircle,
    mode: "ideias",
    prompt: "Ideias para marca pessoal",
  },
  {
    id: "lead-para-conteudo",
    label: "Lead → conteúdo",
    icon: Heart,
    mode: "ideias",
    prompt: "Transformar leads em conteúdo",
  },
];

type AuraSocialProps = {
  leads?: GrowthLead[];
  marca?: InstagramMarca;
  iaAvailable?: boolean;
  iaReason?: string | null;
  onSuggestions: (items: ParsedConteudoSuggestion[], kind?: string) => void;
};

const IA_UNAVAILABLE_MSG =
  "IA indisponível no momento. Você pode continuar cadastrando conteúdos manualmente.";

export function AuraSocial({
  leads = [],
  marca,
  iaAvailable = true,
  iaReason = null,
  onSuggestions,
}: AuraSocialProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Sou sua IA Social Coach — analiso sua vida real (Alvesz, consórcios, viagens Disney/NBA, inglês, metas e calendário) para sugerir o que postar.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeLeads = leads.filter(
    (l) => l.status !== "fechado" && l.status !== "perdido"
  );

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendMessage(
    text: string,
    options?: { actionId?: string; mode?: QuickAction["mode"]; leadId?: string }
  ) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!iaAvailable) {
      setMessages((current) => [
        ...current,
        { role: "user", text: trimmed },
        {
          role: "assistant",
          text: iaReason ?? IA_UNAVAILABLE_MSG,
        },
      ]);
      setInput("");
      scrollToBottom();
      return;
    }

    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    scrollToBottom();

    try {
      const response = await fetch("/api/social-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          ...(options?.actionId ? { actionId: options.actionId } : {}),
          ...(options?.mode ? { mode: options.mode } : {}),
          ...(options?.leadId ? { leadId: options.leadId } : {}),
          ...(marca ? { marca } : {}),
        }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
        kind?: string;
        suggestion?: Record<string, unknown>;
      }>(response);

      if (parseError || !response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: parseError ?? data?.error ?? "Não consegui responder agora.",
          },
        ]);
        return;
      }

      if (data?.error) {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: data.error! },
        ]);
        return;
      }

      const kind = data?.kind ?? "chat";
      const suggestions = parseConteudoSuggestions(data?.suggestion);

      if (suggestions.length > 0) {
        onSuggestions(suggestions, kind);
      }

      if (kind === "calendario" && suggestions.length > 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: `${data?.text ?? "Calendário gerado."}\n\n${suggestions.length} conteúdo(s) prontos para salvar no calendário.`,
          },
        ]);
        return;
      }

      if ((kind === "ideias" || kind === "post-hoje" || kind === "coach") && suggestions.length > 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: `${data?.text ?? "Sugestões geradas."}\n\n${suggestions.length} ideia(s) prontas para salvar.`,
          },
        ]);
        return;
      }

      if (kind === "roteiro" && data?.suggestion) {
        const roteiro = String(data.suggestion.roteiro ?? data.text ?? "");
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: roteiro || "Roteiro gerado.",
          },
        ]);
        if (suggestions.length > 0) {
          onSuggestions(suggestions, kind);
        }
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data?.text ?? "Não consegui responder agora.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Erro ao conectar com a IA Social Coach. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input, {
      leadId: selectedLeadId || undefined,
    });
  }

  function handleQuickAction(action: QuickAction) {
    sendMessage(action.prompt, {
      actionId: action.id,
      mode: action.mode,
      leadId: selectedLeadId || undefined,
    });
  }

  return (
    <Panel className="border-violet-500/10 bg-violet-500/[0.02]">
      <PanelHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-violet-500/15">
            <Sparkles className="size-3.5 text-violet-400" />
          </div>
          <div>
            <PanelTitle>IA Social Coach</PanelTitle>
            <p className="text-[10px] text-zinc-600">
              Inteligência integrada · Alvesz · Consórcios · Disney/NBA
            </p>
          </div>
        </div>
      </PanelHeader>

      <PanelContent className="pt-0">
        <p className="mb-2 text-[11px] font-medium text-violet-200/80">
          Perguntas rápidas
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {COACH_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading || !iaAvailable}
                onClick={() => handleQuickAction(action)}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/15 bg-violet-500/[0.06] px-2.5 py-1.5 text-[11px] text-violet-200 transition-colors hover:border-violet-400/30 hover:bg-violet-500/10 disabled:opacity-50"
              >
                <Icon className="size-3 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>

        {activeLeads.length > 0 && (
          <label className="mb-2 block text-[11px] text-zinc-500">
            Lead para personalizar (opcional)
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[12px] text-zinc-200 focus:outline-none"
            >
              <option value="" className="bg-zinc-900">
                Nenhum lead selecionado
              </option>
              {activeLeads.map((lead) => (
                <option key={lead.id} value={lead.id} className="bg-zinc-900">
                  {lead.nome} ({lead.vertical ?? "—"})
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="mb-1.5 text-[11px] text-zinc-500">Ferramentas</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading || !iaAvailable}
                onClick={() => handleQuickAction(action)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-violet-400/20 hover:bg-violet-500/[0.06] hover:text-violet-200 disabled:opacity-50"
              >
                <Icon className="size-3 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 max-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                message.role === "user"
                  ? "ml-6 bg-white/[0.06] text-zinc-200"
                  : "mr-6 bg-violet-500/10 text-violet-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}

          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-[13px] text-violet-300">
              <Loader2 className="size-3.5 animate-spin" />
              Analisando seus dados...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: o que postar hoje? conteúdo atrasado? gravar esta semana..."
            disabled={loading || !iaAvailable}
            className="h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !iaAvailable}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
