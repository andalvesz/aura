"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CalendarPlus,
  Check,
  Loader2,
  Pencil,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { ActionButton } from "@/components/dashboard/action-button";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useEventos } from "@/hooks/use-eventos";
import { useGrowthLeads } from "@/hooks/use-growth-leads";
import { awardAuraXpClient } from "@/lib/xp/client";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  CHAT_INPUT_CLASS,
  CHAT_SEND_CLASS,
  ICON_BTN_CLASS,
  ICON_BTN_DANGER_CLASS,
} from "@/utils/dashboard-mobile";
import type { Evento } from "@/types/database";
import type { ParsedEventoSuggestion } from "@/utils/calendar";
import {
  eventoPayloadFromSuggestion,
  formatEventoDateDisplay,
  formatEventoTimeDisplay,
  getEventoTipoLabel,
  isEventoConfirmationMessage,
  proximosEventos,
} from "@/utils/calendar";
import { GoogleCalendarPanel } from "@/components/dashboard/google-calendar-panel";
import { GoogleSyncBadge } from "@/components/dashboard/google-sync-badge";
import { AddEventoModal } from "./add-evento-modal";

export function CalendarioView() {
  const {
    data: eventos,
    loading,
    error: eventosError,
    refresh,
    create,
    update,
    remove,
  } = useEventos();
  const { data: leads } = useGrowthLeads();

  const safeEventos = eventos ?? [];
  const safeLeads = leads ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [suggestion, setSuggestion] = useState<ParsedEventoSuggestion | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: 'Olá, Anderson. Diga o que deseja marcar — ex: "Reunião com João amanhã às 15h". Eu sugiro o evento e você confirma antes de salvar.',
    },
  ]);

  const upcoming = useMemo(() => proximosEventos(safeEventos), [safeEventos]);

  function openCreate(initial?: Evento | ParsedEventoSuggestion | null) {
    if (initial && "id" in initial) {
      setEditing(initial);
      setSuggestion(null);
    } else if (initial) {
      setEditing(null);
      setSuggestion(initial);
    } else {
      setEditing(null);
      setSuggestion(null);
    }
    setModalOpen(true);
  }

  async function handleAiSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    if (suggestion && isEventoConfirmationMessage(text)) {
      setAiLoading(true);
      try {
        const result = await create(eventoPayloadFromSuggestion(suggestion));
        if (result.error) {
          setMessages((m) => [
            ...m,
            { role: "assistant", text: result.error },
          ]);
          return;
        }
        setSuggestion(null);
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Evento criado com sucesso" },
        ]);
        toast.success("Evento criado com sucesso");
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Erro ao salvar o evento. Tente novamente ou use Novo evento.",
          },
        ]);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    setAiLoading(true);

    try {
      const res = await fetch("/api/calendar-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        suggestion?: ParsedEventoSuggestion;
        error?: string;
      }>(res);

      if (parseError) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: parseError },
        ]);
        return;
      }

      if (!res.ok || data?.error) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              data?.error ??
              "Não consegui interpretar. Use Novo evento para cadastrar manualmente.",
          },
        ]);
        return;
      }

      const s = data?.suggestion;
      if (!s?.titulo || !s.data) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Não entendi o compromisso. Tente reformular ou cadastre manualmente.",
          },
        ]);
        return;
      }
      setSuggestion(s);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Sugestão: "${s.titulo}" em ${s.data} às ${s.hora} (${getEventoTipoLabel(s.tipo)}). Confirme para salvar ou ajuste no formulário.`,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Erro de conexão. Cadastre manualmente com Novo evento.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleEventoSubmit(payload: {
    titulo: string;
    descricao: string | null;
    data_inicio: string;
    local: string | null;
    tipo: string;
    growth_lead_id: string | null;
  }) {
    if (editing) {
      const result = await update(editing.id, payload);
      return { error: result.error };
    }
    const result = await create(payload);
    if (!result.error) {
      setSuggestion(null);
      await awardAuraXpClient("criar_evento");
    }
    return { error: result.error };
  }

  async function handleCompleteEvento(id: string) {
    const { error } = await update(id, { tipo: "concluido" });
    if (error) {
      toast.error(error);
      return;
    }
    await awardAuraXpClient("concluir_evento");
    toast.success("Evento concluído.");
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este evento?")) return;
    const { error } = await remove(id);
    if (error) toast.error(error);
    else toast.success("Evento excluído.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <ActionButton
          icon={<CalendarPlus className="size-3.5" />}
          className="w-full sm:w-auto"
          onClick={() => openCreate(suggestion)}
        >
          Novo evento
        </ActionButton>
        {suggestion && (
          <ActionButton className="w-full sm:w-auto" onClick={() => openCreate(suggestion)}>
            Confirmar sugestão IA
          </ActionButton>
        )}
      </div>

      {eventosError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/90">
          <span>{eventosError}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-[12px] font-medium text-amber-200 hover:bg-amber-500/15 md:min-h-0 md:px-2 md:py-1 md:text-[11px]"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <GoogleCalendarPanel onImported={() => void refresh()} />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_minmax(0,280px)]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <MiniCalendar
            eventos={safeEventos}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />

          <Panel>
            <PanelHeader>
              <PanelTitle>Próximos eventos</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loading ? (
                <ListSkeleton rows={4} />
              ) : upcoming.length === 0 ? (
                <EmptyState
                  title="Nenhum evento cadastrado"
                  description="Seus compromissos aparecerão aqui."
                  action={
                    <ActionButton onClick={() => openCreate()}>
                      Criar evento
                    </ActionButton>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-white/[0.04] p-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-medium text-zinc-200">
                            {ev.titulo}
                          </p>
                          <GoogleSyncBadge evento={ev} />
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {formatEventoDateDisplay(ev.data_inicio)} ·{" "}
                          {formatEventoTimeDisplay(ev.data_inicio)} ·{" "}
                          {getEventoTipoLabel(ev.tipo)}
                        </p>
                        {ev.descricao && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">
                            {ev.descricao}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        {ev.tipo !== "concluido" && (
                          <button
                            type="button"
                            onClick={() => void handleCompleteEvento(ev.id)}
                            className={ICON_BTN_CLASS}
                            aria-label="Concluir"
                          >
                            <Check className="size-4 md:size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openCreate(ev)}
                          className={ICON_BTN_CLASS}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4 md:size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ev.id)}
                          className={ICON_BTN_DANGER_CLASS}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4 md:size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>
        </div>

        <Panel className="flex min-h-[280px] flex-col sm:min-h-[320px] xl:min-h-[420px]">
          <PanelHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-violet-500/15">
                <Sparkles className="size-3.5 text-violet-400" />
              </div>
              <PanelTitle>Aura Agenda</PanelTitle>
            </div>
            <Bot className="size-4 text-zinc-600" />
          </PanelHeader>
          <PanelContent className="flex flex-1 flex-col pt-0">
            <div className="mb-2 max-h-[280px] flex-1 space-y-2 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-md px-2.5 py-2 text-[12px] ${
                    msg.role === "user"
                      ? "ml-4 bg-white/[0.06] text-zinc-200"
                      : "mr-4 bg-violet-500/10 text-violet-100/90"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {aiLoading && (
                <div className="mr-4 flex items-center gap-2 rounded-md bg-violet-500/10 px-2.5 py-2 text-[12px] text-violet-200/80">
                  <Loader2 className="size-3 animate-spin" />
                  Interpretando...
                </div>
              )}
            </div>
            <form onSubmit={handleAiSend} className="mt-auto flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Marcar reunião com João amanhã às 15h..."
                disabled={aiLoading}
                className={CHAT_INPUT_CLASS}
              />
              <button
                type="submit"
                disabled={aiLoading}
                className={CHAT_SEND_CLASS}
                aria-label="Enviar"
              >
                <Send className="size-4 md:size-3.5" />
              </button>
            </form>
          </PanelContent>
        </Panel>
      </div>

      <AddEventoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        leads={safeLeads}
        initial={editing ?? suggestion}
        onSubmit={handleEventoSubmit}
      />
    </div>
  );
}
