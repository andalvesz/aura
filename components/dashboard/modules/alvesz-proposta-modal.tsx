"use client";

import { Copy, FileText, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { Cliente, Orcamento } from "@/types/database";
import {
  buildAlveszProposta,
  DEFAULT_ALVESZ_PROPOSTA_PDF_META,
  formatPropostaWhatsApp,
} from "@/utils/alvesz-proposta";
import { ActionButton } from "../action-button";

type AlveszPropostaModalProps = {
  open: boolean;
  onClose: () => void;
  orcamento: Orcamento | null;
  cliente: Cliente | null;
  onSave: (payload: {
    orcamento_id: string;
    conteudo: string;
    melhorada_ia: boolean;
  }) => Promise<{ error: string | null }>;
};

export function AlveszPropostaModal({
  open,
  onClose,
  orcamento,
  cliente,
  onSave,
}: AlveszPropostaModalProps) {
  const [conteudo, setConteudo] = useState("");
  const [melhoradaIa, setMelhoradaIa] = useState(false);
  const [iaPending, setIaPending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const baseProposta = useMemo(() => {
    if (!orcamento) return "";
    return buildAlveszProposta({ orcamento, cliente });
  }, [orcamento, cliente]);

  useEffect(() => {
    if (open && baseProposta) {
      setConteudo(baseProposta);
      setMelhoradaIa(false);
    }
    if (!open) {
      setConteudo("");
      setMelhoradaIa(false);
    }
  }, [open, baseProposta]);

  async function handleMelhorarIa() {
    if (!conteudo.trim()) return;
    setIaPending(true);
    try {
      const res = await fetch("/api/alvesz-proposta-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposta: conteudo }),
      });
      const data = (await res.json()) as { conteudo?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao melhorar proposta.");
        return;
      }
      if (data.conteudo) {
        setConteudo(data.conteudo);
        setMelhoradaIa(true);
        toast.success("Proposta aprimorada com IA.");
      }
    } catch {
      toast.error("Falha na conexão com a IA.");
    } finally {
      setIaPending(false);
    }
  }

  async function handleCopiarWhatsApp() {
    const texto = formatPropostaWhatsApp(conteudo);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Proposta copiada para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  async function handleSalvar() {
    if (!orcamento || !conteudo.trim()) return;
    setSavePending(true);
    const { error } = await onSave({
      orcamento_id: orcamento.id,
      conteudo: conteudo.trim(),
      melhorada_ia: melhoradaIa,
    });
    setSavePending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Proposta salva.");
    onClose();
  }

  if (!orcamento) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proposta comercial"
      description="Alvesz Experience — revisão, IA e envio"
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={18}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 focus:outline-none"
          spellCheck={false}
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
            onClick={handleMelhorarIa}
            disabled={iaPending || !conteudo.trim()}
          >
            Melhorar proposta com IA
          </ActionButton>
          <ActionButton
            icon={<Copy className="size-3.5" />}
            onClick={handleCopiarWhatsApp}
            disabled={!conteudo.trim()}
          >
            Copiar proposta para WhatsApp
          </ActionButton>
          <ActionButton
            icon={
              savePending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )
            }
            onClick={handleSalvar}
            disabled={savePending || !conteudo.trim()}
          >
            Salvar proposta
          </ActionButton>
        </div>

        <p
          className="text-[10px] text-zinc-600"
          title={JSON.stringify(DEFAULT_ALVESZ_PROPOSTA_PDF_META)}
        >
          Exportar PDF — em breve (estrutura preparada: pdf_meta v
          {DEFAULT_ALVESZ_PROPOSTA_PDF_META.version})
        </p>
      </div>
    </Modal>
  );
}
