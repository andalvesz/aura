"use client";

import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { ActionButton } from "@/components/dashboard/action-button";
import { formatBRL } from "@/utils/format";
import {
  buildDefaultWhatsAppMessage,
  type WhatsAppIaContext,
  type WhatsAppIntent,
} from "@/utils/whatsapp-ia";
import {
  openWhatsAppLink,
  WHATSAPP_NO_PHONE_MESSAGE,
} from "@/utils/whatsapp";

type WhatsAppAssistidoModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  telefone: string | null | undefined;
  intent: WhatsAppIntent;
  context: WhatsAppIaContext;
  onMarkContacted?: () => Promise<{ error: string | null }>;
};

export function WhatsAppAssistidoModal({
  open,
  onClose,
  title,
  description,
  telefone,
  intent,
  context,
  onMarkContacted,
}: WhatsAppAssistidoModalProps) {
  const defaultMessage = useMemo(
    () => buildDefaultWhatsAppMessage(context),
    [context]
  );
  const [message, setMessage] = useState(defaultMessage);
  const [iaPending, setIaPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(defaultMessage);
  }, [open, defaultMessage]);

  const hasPhone = Boolean(telefone?.trim());

  async function handleGerarIa() {
    setIaPending(true);
    try {
      const res = await fetch("/api/whatsapp-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          context,
          baseMessage: message,
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        fallback?: boolean;
      };

      if (!res.ok && !data.message) {
        toast.error(data.error ?? "Erro ao gerar mensagem.");
        return;
      }

      if (data.message) {
        setMessage(data.message);
        if (data.fallback) {
          toast.info(data.error ?? "Modelo padrão aplicado.");
        } else {
          toast.success("Mensagem gerada com IA.");
        }
      }
    } catch {
      toast.error("Falha na conexão com a IA.");
    } finally {
      setIaPending(false);
    }
  }

  async function handleAbrirWhatsApp() {
    const result = openWhatsAppLink(telefone, message);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("WhatsApp aberto com a mensagem pronta.");
    if (onMarkContacted) {
      const { error } = await onMarkContacted();
      if (error) toast.info(`WhatsApp aberto, mas não atualizou contato: ${error}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <ContextSummary context={context} />

        {!hasPhone && (
          <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/90">
            {WHATSAPP_NO_PHONE_MESSAGE}
          </p>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-zinc-300 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={
              iaPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )
            }
            onClick={handleGerarIa}
            disabled={iaPending}
          >
            Gerar com IA
          </ActionButton>
          <ActionButton
            icon={<ExternalLink className="size-3.5" />}
            onClick={handleAbrirWhatsApp}
            disabled={!hasPhone || !message.trim()}
          >
            Abrir WhatsApp
          </ActionButton>
        </div>

        <p className="text-[10px] text-zinc-600">
          A Aura não envia automaticamente — apenas abre o WhatsApp com o texto pronto.
        </p>
      </div>
    </Modal>
  );
}

function ContextSummary({ context }: { context: WhatsAppIaContext }) {
  if (context.intent === "lead") {
    return (
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
        <p>
          <span className="text-zinc-400">Lead:</span> {context.nome}
        </p>
        <p>
          <span className="text-zinc-400">Interesse:</span> {context.interesse} ·{" "}
          {context.statusLabel}
        </p>
        <p>
          <span className="text-zinc-400">Valor:</span>{" "}
          {context.valor > 0 ? formatBRL(context.valor) : "—"} · Último contato há{" "}
          {context.ultimoContatoDias} dia(s)
        </p>
      </div>
    );
  }

  if (context.intent === "proposta") {
    return (
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
        <p>
          <span className="text-zinc-400">Cliente:</span> {context.nomeCliente}
        </p>
        <p>
          <span className="text-zinc-400">Evento:</span> {context.evento} ·{" "}
          {formatBRL(context.valor)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
      <p>
        <span className="text-zinc-400">Cliente:</span> {context.nome}
      </p>
      <p>
        <span className="text-zinc-400">Evento:</span> {context.tipoEvento} ·{" "}
        {formatBRL(context.valor)} · {context.statusLabel}
      </p>
    </div>
  );
}
