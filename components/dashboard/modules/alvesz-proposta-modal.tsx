"use client";

import {
  Copy,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, Orcamento } from "@/types/database";
import {
  buildAlveszPropostaPdfFields,
  generateAlveszPropostaPdf,
  pdfBytesToBase64,
} from "@/utils/alvesz-proposta-pdf";
import {
  appendPdfHistoryEntry,
  buildAlveszProposta,
  formatPropostaWhatsApp,
  nextPdfVersion,
  type AlveszPropostaPdfMeta,
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
    pdf_meta: AlveszPropostaPdfMeta;
  }) => Promise<{ error: string | null; data?: { id: string } }>;
};

export function AlveszPropostaModal({
  open,
  onClose,
  orcamento,
  cliente,
  onSave,
}: AlveszPropostaModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [conteudo, setConteudo] = useState("");
  const [melhoradaIa, setMelhoradaIa] = useState(false);
  const [iaPending, setIaPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [pdfMeta, setPdfMeta] = useState<AlveszPropostaPdfMeta | null>(null);

  const baseProposta = useMemo(() => {
    if (!orcamento) return "";
    return buildAlveszProposta({ orcamento, cliente });
  }, [orcamento, cliente]);

  useEffect(() => {
    if (open && baseProposta) {
      setConteudo(baseProposta);
      setMelhoradaIa(false);
      setPdfUrl(null);
      setPropostaId(null);
      setPdfMeta(null);
    }
    if (!open) {
      setConteudo("");
      setMelhoradaIa(false);
      setPdfUrl(null);
      setPropostaId(null);
      setPdfMeta(null);
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

  async function handleGerarPdf() {
    if (!orcamento || !conteudo.trim()) return;
    setPdfPending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para gerar o PDF.");
        return;
      }

      const fields = buildAlveszPropostaPdfFields({ orcamento, cliente });
      const bytes = await generateAlveszPropostaPdf(fields);
      const version = nextPdfVersion(pdfMeta ?? undefined);
      const exportedAt = new Date().toISOString();
      const userLabel = user.email ?? user.id;
      const nextMeta = appendPdfHistoryEntry(
        {
          ready: false,
          version,
          templateId: "alvesz-premium-v1",
          history: pdfMeta?.history,
        },
        { version, exportedAt, userId: user.id, userLabel }
      );

      const res = await fetch("/api/alvesz-proposta-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamento_id: orcamento.id,
          proposta_id: propostaId,
          conteudo: conteudo.trim(),
          melhorada_ia: melhoradaIa,
          pdf_base64: pdfBytesToBase64(bytes),
          pdf_meta: nextMeta,
        }),
      });

      const data = (await res.json()) as {
        pdfUrl?: string;
        publicUrl?: string;
        propostaId?: string;
        pdf_meta?: AlveszPropostaPdfMeta;
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao gerar PDF.");
        return;
      }

      const link = data.publicUrl ?? data.pdfUrl ?? null;
      setPdfUrl(link);
      setPropostaId(data.propostaId ?? propostaId);
      setPdfMeta(data.pdf_meta ?? nextMeta);

      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-alvesz-v${version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`PDF v${version} gerado e salvo no histórico.`);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setPdfPending(false);
    }
  }

  async function handleCompartilhar() {
    const texto = formatPropostaWhatsApp(conteudo, pdfUrl);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto e link do PDF copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  async function handleSalvar() {
    if (!orcamento || !conteudo.trim()) return;
    setSavePending(true);
    const meta: AlveszPropostaPdfMeta = pdfMeta ?? {
      ready: false,
      version: 1,
      templateId: "alvesz-premium-v1",
    };
    const { error, data } = await onSave({
      orcamento_id: orcamento.id,
      conteudo: conteudo.trim(),
      melhorada_ia: melhoradaIa,
      pdf_meta: meta,
    });
    setSavePending(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.id) setPropostaId(data.id);
    toast.success("Proposta salva.");
    onClose();
  }

  if (!orcamento) return null;

  const ultimaVersao = pdfMeta?.history?.[pdfMeta.history.length - 1];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proposta comercial"
      description="Alvesz Experience — PDF premium, IA e envio"
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

        {ultimaVersao && (
          <p className="text-[10px] text-zinc-500">
            Último PDF: v{ultimaVersao.version} ·{" "}
            {new Date(ultimaVersao.exportedAt).toLocaleString("pt-BR")} ·{" "}
            {ultimaVersao.userLabel ?? ultimaVersao.userId.slice(0, 8)}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={
              pdfPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )
            }
            onClick={handleGerarPdf}
            disabled={pdfPending || !conteudo.trim()}
          >
            Gerar PDF
          </ActionButton>
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
            Melhorar proposta
          </ActionButton>
          <ActionButton
            icon={<MessageCircle className="size-3.5" />}
            onClick={handleCompartilhar}
            disabled={!conteudo.trim()}
          >
            Compartilhar proposta
          </ActionButton>
          <ActionButton
            icon={<Copy className="size-3.5" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(formatPropostaWhatsApp(conteudo));
                toast.success("Texto copiado.");
              } catch {
                toast.error("Não foi possível copiar.");
              }
            }}
            disabled={!conteudo.trim()}
          >
            Copiar texto
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

        {pdfUrl && (
          <p className="text-[10px] text-violet-400/80 break-all">
            Link PDF: {pdfUrl}
          </p>
        )}
      </div>
    </Modal>
  );
}
