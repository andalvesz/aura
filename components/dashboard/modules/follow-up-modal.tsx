"use client";

import { CalendarPlus, Copy, ExternalLink, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import {
  buildDefaultFollowUpMessages,
  buildFollowUpEventoPayload,
  type FollowUpChannel,
  type FollowUpContext,
  getFollowUpTierLabel,
} from "@/utils/follow-up";
import { formatBRL } from "@/utils/format";
import { openWhatsAppLink, WHATSAPP_NO_PHONE_MESSAGE } from "@/utils/whatsapp";
import { ActionButton } from "../action-button";

const CHANNELS: { id: FollowUpChannel; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram Direct" },
  { id: "email", label: "E-mail" },
];

type FollowUpModalProps = {
  open: boolean;
  onClose: () => void;
  context: FollowUpContext | null;
  onScheduleFollowUp: (payload: ReturnType<typeof buildFollowUpEventoPayload>) => Promise<{
    error: string | null;
  }>;
  onMarkContacted?: () => Promise<{ error: string | null }>;
};

export function FollowUpModal({
  open,
  onClose,
  context,
  onScheduleFollowUp,
  onMarkContacted,
}: FollowUpModalProps) {
  const [channel, setChannel] = useState<FollowUpChannel>("whatsapp");
  const [message, setMessage] = useState("");
  const [iaPending, setIaPending] = useState(false);
  const [schedulePending, setSchedulePending] = useState(false);

  const defaults = useMemo(
    () => (context ? buildDefaultFollowUpMessages(context) : null),
    [context]
  );

  useEffect(() => {
    if (!open || !defaults) return;
    setChannel("whatsapp");
    setMessage(defaults.whatsapp);
  }, [open, defaults]);

  useEffect(() => {
    if (!defaults) return;
    setMessage(defaults[channel]);
  }, [channel, defaults]);

  async function handleMelhorarIa() {
    if (!context || !message.trim()) return;
    setIaPending(true);
    try {
      const res = await fetch("/api/follow-up-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          context: {
            nome: context.nome,
            tipoEvento: context.tipoEvento,
            valor: context.valor,
            statusLabel: context.statusLabel,
            idleDays: context.idleDays,
            historico: context.historico,
          },
          baseMessage: message,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao melhorar mensagem.");
        return;
      }
      if (data.message) {
        setMessage(data.message);
        toast.success("Mensagem aprimorada com IA.");
      }
    } catch {
      toast.error("Falha na conexão com a IA.");
    } finally {
      setIaPending(false);
    }
  }

  async function handleAbrirWhatsApp() {
    if (!context) return;
    const result = openWhatsAppLink(context.telefone, message);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("WhatsApp aberto com a mensagem pronta.");
    if (onMarkContacted) {
      const { error } = await onMarkContacted();
      if (error) toast.info(`WhatsApp aberto, mas não atualizou lead: ${error}`);
    }
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada.");
      if (onMarkContacted) {
        const { error } = await onMarkContacted();
        if (error) toast.info(`Copiado, mas não atualizou lead: ${error}`);
      }
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function handleAgendar() {
    if (!context) return;
    setSchedulePending(true);
    const { error } = await onScheduleFollowUp(buildFollowUpEventoPayload(context));
    setSchedulePending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Follow-up agendado no calendário (+3 dias).");
    onClose();
  }

  if (!context) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar follow-up"
      description={
        context.idleTier
          ? `${getFollowUpTierLabel(context.idleTier)} · ${context.tipoEvento}`
          : context.tipoEvento
      }
      className="max-w-lg"
    >
      <div className="space-y-3">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
          <p>
            <span className="text-zinc-400">Cliente:</span> {context.nome}
          </p>
          <p>
            <span className="text-zinc-400">Valor:</span> {formatBRL(context.valor)} ·{" "}
            {context.statusLabel}
          </p>
          <p className="mt-1 text-zinc-600">{context.historico}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                channel === c.id
                  ? "bg-violet-500/20 text-violet-200"
                  : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-zinc-300 focus:outline-none"
        />

        {channel === "whatsapp" && !context.telefone?.trim() && (
          <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/90">
            {WHATSAPP_NO_PHONE_MESSAGE}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={
              iaPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )
            }
            onClick={handleMelhorarIa}
            disabled={iaPending || !message.trim()}
          >
            Melhorar com IA
          </ActionButton>
          <ActionButton
            icon={<Copy className="size-3.5" />}
            onClick={handleCopiar}
            disabled={!message.trim()}
          >
            Copiar mensagem
          </ActionButton>
          {channel === "whatsapp" && (
            <ActionButton
              icon={<ExternalLink className="size-3.5" />}
              onClick={handleAbrirWhatsApp}
              disabled={!message.trim() || !context.telefone?.trim()}
            >
              Abrir WhatsApp
            </ActionButton>
          )}
          <ActionButton
            icon={
              schedulePending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="size-3.5" />
              )
            }
            onClick={handleAgendar}
            disabled={schedulePending}
          >
            Agendar follow-up daqui 3 dias?
          </ActionButton>
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <MessageCircle className="size-3" />
          Ao copiar ou abrir WhatsApp, a Aura atualiza a data de contato do lead.
        </p>
      </div>
    </Modal>
  );
}
