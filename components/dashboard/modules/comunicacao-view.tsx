"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { ActionButton } from "@/components/dashboard/action-button";
import { FollowUpModal } from "@/components/dashboard/modules/follow-up-modal";
import { useClientes, useEventos, useGrowthLeads, useOrcamentos } from "@/hooks";
import type { CommunicationLog } from "@/types/database";
import type { GmailMessageSummary } from "@/utils/comms";
import {
  COMMS_STATUS_LABELS,
  COMMS_STATUS_STYLES,
  formatGmailFrom,
} from "@/utils/comms";
import {
  buildDefaultFollowUpMessages,
  getTopStaleOpportunity,
  listStaleOpportunities,
  type FollowUpChannel,
  type FollowUpContext,
} from "@/utils/follow-up";
import { formatBRL, formatSafeDate } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";
import { openWhatsAppLink } from "@/utils/whatsapp";

type TabId = "gmail" | "alvesz" | "followup";

export function ComunicacaoView() {
  const searchParams = useSearchParams();
  const { data: clientes } = useClientes();
  const { data: orcamentos } = useOrcamentos();
  const { data: leads } = useGrowthLeads();
  const { create: createEvento } = useEventos();

  const [tab, setTab] = useState<TabId>("gmail");
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    configured: false,
    email: null as string | null,
  });
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadBody, setThreadBody] = useState("");
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpContext, setFollowUpContext] = useState<FollowUpContext | null>(null);
  const [followChannel, setFollowChannel] = useState<FollowUpChannel>("email");
  const [followMessage, setFollowMessage] = useState("");
  const [iaPending, setIaPending] = useState(false);

  const [sendPropostaId, setSendPropostaId] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");

  const staleOpps = useMemo(
    () => listStaleOpportunities({ leads: leads ?? [], orcamentos: orcamentos ?? [], clientes: clientes ?? [] }),
    [leads, orcamentos, clientes]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, msgRes, logsRes] = await Promise.all([
        fetch("/api/gmail/status"),
        fetch("/api/gmail/messages"),
        fetch("/api/comms/logs"),
      ]);

      const statusJson = await parseJsonResponse<typeof gmailStatus>(statusRes);
      if (statusJson.data) setGmailStatus(statusJson.data);

      const msgJson = await parseJsonResponse<{ messages?: GmailMessageSummary[] }>(msgRes);
      if (msgJson.data?.messages) setMessages(msgJson.data.messages);

      const logsJson = await parseJsonResponse<{ logs?: CommunicationLog[] }>(logsRes);
      if (logsJson.data?.logs) setLogs(logsJson.data.logs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const g = searchParams.get("gmail");
    if (g === "connected") toast.success("Gmail conectado ao Centro de Comunicação.");
  }, [searchParams]);

  async function searchByCliente() {
    const cliente = (clientes ?? []).find((c) =>
      c.nome.toLowerCase().includes(searchCliente.toLowerCase())
    );
    if (!cliente && !searchCliente.includes("@")) {
      toast.error("Cliente não encontrado.");
      return;
    }

    setActionLoading(true);
    try {
      const q = new URLSearchParams();
      if (cliente?.email) q.set("email", cliente.email);
      q.set("nome", cliente?.nome ?? searchCliente);
      const res = await fetch(`/api/gmail/search?${q}`);
      const { data } = await parseJsonResponse<{ messages?: GmailMessageSummary[]; error?: string }>(
        res
      );
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setMessages(data?.messages ?? []);
    } finally {
      setActionLoading(false);
    }
  }

  async function openThread(threadId: string) {
    setSelectedThread(threadId);
    setThreadBody("");
    const res = await fetch(`/api/gmail/thread/${threadId}`);
    const { data } = await parseJsonResponse<{ bodyText?: string; error?: string }>(res);
    if (data?.bodyText) setThreadBody(data.bodyText);
    if (data?.error) toast.error(data.error);
  }

  async function sendPropostaEmail() {
    if (!sendPropostaId || !sendEmail) {
      toast.error("Informe ID da proposta e e-mail do destinatário.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/comms/send-proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propostaId: sendPropostaId,
          toEmail: sendEmail,
          subject: sendSubject || undefined,
        }),
      });
      const { data } = await parseJsonResponse<{ error?: string }>(res);
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Proposta enviada por e-mail.");
      void refreshAll();
    } finally {
      setActionLoading(false);
    }
  }

  function openFollowUp(ctx: FollowUpContext) {
    setFollowUpContext(ctx);
    const defaults = buildDefaultFollowUpMessages(ctx);
    setFollowChannel("whatsapp");
    setFollowMessage(defaults.whatsapp);
    setFollowUpOpen(true);
  }

  async function generateFollowUpIa() {
    if (!followUpContext) return;
    setIaPending(true);
    try {
      const res = await fetch("/api/follow-up-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: followChannel,
          context: {
            nome: followUpContext.nome,
            tipoEvento: followUpContext.tipoEvento,
            valor: followUpContext.valor,
            statusLabel: followUpContext.statusLabel,
            idleDays: followUpContext.idleDays,
            historico: followUpContext.historico,
          },
        }),
      });
      const { data } = await parseJsonResponse<{ text?: string; error?: string }>(res);
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.text) setFollowMessage(data.text);
    } finally {
      setIaPending(false);
    }
  }

  const topOpp = getTopStaleOpportunity({
    leads: leads ?? [],
    orcamentos: orcamentos ?? [],
    clientes: clientes ?? [],
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "gmail" as const, label: "Gmail" },
            { id: "alvesz" as const, label: "Alvesz" },
            { id: "followup" as const, label: "Follow-up" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-indigo-500/20 text-indigo-200"
                : "border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          <RefreshCw className="size-3" />
          Atualizar
        </button>
      </div>

      {tab === "gmail" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2">
                <Mail className="size-4 text-indigo-400" />
                Gmail
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3 pt-0">
              {!gmailStatus.configured ? (
                <p className="text-[12px] text-zinc-500">
                  Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET. O calendário e demais módulos
                  continuam normais.
                </p>
              ) : !gmailStatus.connected ? (
                <>
                  <p className="text-[12px] text-zinc-500">
                    Conecte o Google para listar e-mails e enviar propostas.
                  </p>
                  <a
                    href="/api/gmail/connect"
                    className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-indigo-500"
                  >
                    Conectar Gmail
                  </a>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-zinc-500">
                    Conectado: <span className="text-zinc-300">{gmailStatus.email}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={searchCliente}
                      onChange={(e) => setSearchCliente(e.target.value)}
                      placeholder="Buscar por cliente..."
                      className="h-9 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
                    />
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void searchByCliente()}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-white/[0.08] text-zinc-400 hover:bg-white/[0.04]"
                    >
                      <Search className="size-4" />
                    </button>
                  </div>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin text-zinc-500" />
                  ) : (
                    <ul className="max-h-[360px] space-y-1 overflow-y-auto">
                      {messages.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => void openThread(m.threadId)}
                            className={`w-full rounded-md px-2 py-2 text-left text-[12px] transition-colors ${
                              selectedThread === m.threadId
                                ? "bg-indigo-500/15 text-indigo-100"
                                : "hover:bg-white/[0.04] text-zinc-300"
                            }`}
                          >
                            <p className="font-medium truncate">
                              {m.isUnread && "• "}
                              {m.subject}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {formatGmailFrom(m.from)} · {formatSafeDate(m.date)}
                            </p>
                            <p className="line-clamp-1 text-[10px] text-zinc-500">{m.snippet}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Conversa</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {selectedThread ? (
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-[12px] text-zinc-400">
                  {threadBody || "Carregando mensagem..."}
                </pre>
              ) : (
                <p className="text-[12px] text-zinc-600">Selecione um e-mail para abrir a conversa.</p>
              )}
            </PanelContent>
          </Panel>
        </div>
      )}

      {tab === "alvesz" && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Enviar proposta PDF por e-mail</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[12px] text-zinc-500">
              Registra o envio e inclui pixel de rastreio para abertura (quando o cliente permitir
              imagens no e-mail).
            </p>
            <input
              value={sendPropostaId}
              onChange={(e) => setSendPropostaId(e.target.value)}
              placeholder="ID da proposta (alvesz_propostas)"
              className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px]"
            />
            <input
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="E-mail do cliente"
              className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px]"
            />
            <input
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              placeholder="Assunto (opcional)"
              className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px]"
            />
            <ActionButton
              icon={<Send className="size-3.5" />}
              disabled={actionLoading || !gmailStatus.connected}
              onClick={() => void sendPropostaEmail()}
            >
              Enviar proposta
            </ActionButton>

            <div className="border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-[11px] font-medium text-zinc-500">Histórico de envios</p>
              <ul className="space-y-1.5">
                {logs
                  .filter((l) => l.proposta_id)
                  .slice(0, 8)
                  .map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between rounded-md bg-white/[0.02] px-2 py-1.5 text-[11px]"
                    >
                      <span className="truncate text-zinc-400">{l.recipient ?? l.subject}</span>
                      <span
                        className={`shrink-0 rounded border px-1 py-0.5 text-[9px] ${COMMS_STATUS_STYLES[l.status as keyof typeof COMMS_STATUS_STYLES]}`}
                      >
                        {COMMS_STATUS_LABELS[l.status]}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </PanelContent>
        </Panel>
      )}

      {tab === "followup" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2">
                <MessageCircle className="size-4 text-amber-400" />
                Oportunidades
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {staleOpps.length === 0 ? (
                <p className="text-[12px] text-zinc-500">Nenhum follow-up pendente.</p>
              ) : (
                <ul className="space-y-2">
                  {staleOpps.slice(0, 8).map((item) => (
                    <li
                      key={item.context.nome + (item.context.orcamentoId ?? "")}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-zinc-200">
                          {item.context.nome}
                        </p>
                        <p className="text-[10px] text-zinc-600">
                          {item.context.tipoEvento} · {formatBRL(item.context.valor)} ·{" "}
                          {item.context.idleDays}d parado
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openFollowUp(item.context)}
                        className="shrink-0 rounded-md bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200"
                      >
                        Gerar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Gerar mensagem</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {topOpp ? (
                <>
                  <div className="flex gap-1">
                    {(["whatsapp", "instagram", "email"] as FollowUpChannel[]).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          setFollowChannel(ch);
                          if (followUpContext) {
                            setFollowMessage(buildDefaultFollowUpMessages(followUpContext)[ch]);
                          } else {
                            setFollowMessage(buildDefaultFollowUpMessages(topOpp.context)[ch]);
                            setFollowUpContext(topOpp.context);
                          }
                        }}
                        className={`rounded px-2 py-1 text-[10px] capitalize ${
                          followChannel === ch
                            ? "bg-white/[0.08] text-zinc-200"
                            : "text-zinc-600"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={followMessage}
                    onChange={(e) => setFollowMessage(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] p-2 text-[12px] text-zinc-300"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={iaPending}
                      onClick={() => void generateFollowUpIa()}
                      className="rounded-md bg-violet-600 px-2.5 py-1.5 text-[11px] text-white disabled:opacity-50"
                    >
                      {iaPending ? "Gerando..." : "Melhorar com IA"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(followMessage);
                        toast.success("Copiado.");
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-zinc-400"
                    >
                      <Copy className="size-3" />
                      Copiar
                    </button>
                    {followChannel === "whatsapp" && followUpContext?.telefone && (
                      <button
                        type="button"
                        onClick={() => openWhatsAppLink(followUpContext.telefone!, followMessage)}
                        className="rounded-md bg-emerald-600/20 px-2.5 py-1.5 text-[11px] text-emerald-300"
                      >
                        Abrir WhatsApp
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-zinc-500">Selecione uma oportunidade ao lado.</p>
              )}
            </PanelContent>
          </Panel>
        </div>
      )}

      <FollowUpModal
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        context={followUpContext}
        onScheduleFollowUp={async (payload) => {
          const result = await createEvento(payload);
          return { error: result.error };
        }}
      />
    </div>
  );
}
