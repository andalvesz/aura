"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  Copy,
  History,
  LayoutDashboard,
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
import { MetricCard } from "@/components/dashboard/metric-card";
import { FollowUpModal } from "@/components/dashboard/modules/follow-up-modal";
import {
  useAlveszPropostas,
  useClientes,
  useEventos,
  useGrowthLeads,
  useOrcamentos,
} from "@/hooks";
import { logCommsContactClient } from "@/lib/comms/client";
import type { AlveszProposta, CommunicationLog } from "@/types/database";
import type { CommsDashboardStats, GmailMessageSummary } from "@/utils/comms";
import {
  COMMS_CHANNEL_LABELS,
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

type TabId = "dashboard" | "gmail" | "propostas" | "followup" | "historico";

type PropostaOption = {
  proposta: AlveszProposta;
  clienteNome: string;
  clienteEmail: string | null;
  tipoEvento: string;
  valor: number;
};

export function ComunicacaoView() {
  const searchParams = useSearchParams();
  const { data: clientes } = useClientes();
  const { data: orcamentos } = useOrcamentos();
  const { data: leads } = useGrowthLeads();
  const { data: propostas } = useAlveszPropostas();
  const { create: createEvento } = useEventos();

  const [tab, setTab] = useState<TabId>("dashboard");
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    configured: false,
    email: null as string | null,
  });
  const [stats, setStats] = useState<CommsDashboardStats | null>(null);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadBody, setThreadBody] = useState("");
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpContext, setFollowUpContext] = useState<FollowUpContext | null>(null);
  const [followChannel, setFollowChannel] = useState<FollowUpChannel>("whatsapp");
  const [followMessage, setFollowMessage] = useState("");
  const [iaPending, setIaPending] = useState(false);

  const [selectedPropostaId, setSelectedPropostaId] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");

  const staleOpps = useMemo(
    () =>
      listStaleOpportunities({
        leads: leads ?? [],
        orcamentos: orcamentos ?? [],
        clientes: clientes ?? [],
      }),
    [leads, orcamentos, clientes]
  );

  const propostaOptions = useMemo((): PropostaOption[] => {
    const orcById = new Map((orcamentos ?? []).map((o) => [o.id, o]));
    const cliById = new Map((clientes ?? []).map((c) => [c.id, c]));

    return (propostas ?? [])
      .map((proposta) => {
        const orcamento = orcById.get(proposta.orcamento_id);
        const cliente = orcamento?.cliente_id
          ? (cliById.get(orcamento.cliente_id) ?? null)
          : null;
        return {
          proposta,
          clienteNome: cliente?.nome ?? "Cliente",
          clienteEmail: cliente?.email ?? null,
          tipoEvento: orcamento?.tipo_evento ?? "Evento",
          valor: Number(orcamento?.valor_total ?? 0),
        };
      })
      .sort((a, b) => b.proposta.created_at.localeCompare(a.proposta.created_at));
  }, [propostas, orcamentos, clientes]);

  const selectedProposta = propostaOptions.find(
    (p) => p.proposta.id === selectedPropostaId
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, msgRes, logsRes, statsRes] = await Promise.all([
        fetch("/api/gmail/status"),
        fetch("/api/gmail/messages"),
        fetch("/api/comms/logs"),
        fetch("/api/comms/stats"),
      ]);

      const statusJson = await parseJsonResponse<typeof gmailStatus>(statusRes);
      if (statusJson.data) setGmailStatus(statusJson.data);

      const msgJson = await parseJsonResponse<{ messages?: GmailMessageSummary[] }>(msgRes);
      if (msgJson.data?.messages) setMessages(msgJson.data.messages);

      const logsJson = await parseJsonResponse<{ logs?: CommunicationLog[] }>(logsRes);
      if (logsJson.data?.logs) setLogs(logsJson.data.logs);

      const statsJson = await parseJsonResponse<CommsDashboardStats & { error?: string }>(
        statsRes
      );
      if (statsJson.data && !statsJson.data.error) setStats(statsJson.data);
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

  useEffect(() => {
    if (!selectedProposta) return;
    if (!sendEmail && selectedProposta.clienteEmail) {
      setSendEmail(selectedProposta.clienteEmail);
    }
    if (!sendSubject) {
      setSendSubject(
        `Proposta Alvesz Experience — ${selectedProposta.tipoEvento}`
      );
    }
  }, [selectedProposta, sendEmail, sendSubject]);

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
      const { data } = await parseJsonResponse<{
        messages?: GmailMessageSummary[];
        error?: string;
      }>(res);
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
    if (!selectedPropostaId || !sendEmail) {
      toast.error("Selecione uma proposta e informe o e-mail do destinatário.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/comms/send-proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propostaId: selectedPropostaId,
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
    const ctx = followUpContext ?? topOpp?.context;
    if (!ctx) return;
    setIaPending(true);
    try {
      const res = await fetch("/api/follow-up-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: followChannel,
          context: {
            nome: ctx.nome,
            tipoEvento: ctx.tipoEvento,
            valor: ctx.valor,
            statusLabel: ctx.statusLabel,
            idleDays: ctx.idleDays,
            historico: ctx.historico,
            clienteEmail: ctx.clienteEmail,
            telefone: ctx.telefone,
            orcamentoId: ctx.orcamentoId,
            leadId: ctx.leadId,
          },
          baseMessage: followMessage,
        }),
      });
      const { data } = await parseJsonResponse<{ message?: string; error?: string }>(res);
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.message) {
        setFollowMessage(data.message);
        toast.success("Mensagem aprimorada com IA.");
      }
    } finally {
      setIaPending(false);
    }
  }

  async function handleOpenWhatsApp() {
    const ctx = followUpContext ?? topOpp?.context;
    if (!ctx?.telefone) {
      toast.error("Telefone não cadastrado.");
      return;
    }
    const result = openWhatsAppLink(ctx.telefone, followMessage);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await logCommsContactClient({
      channel: "whatsapp",
      bodyPreview: followMessage,
      recipient: ctx.telefone,
      clienteId: ctx.clienteId,
      orcamentoId: ctx.orcamentoId,
      leadId: ctx.leadId,
      metadata: { action: "comms_tab_whatsapp" },
    });
    toast.success("WhatsApp aberto.");
    void refreshAll();
  }

  const topOpp = getTopStaleOpportunity({
    leads: leads ?? [],
    orcamentos: orcamentos ?? [],
    clientes: clientes ?? [],
  });

  const tabs = [
    { id: "dashboard" as const, label: "Painel", icon: LayoutDashboard },
    { id: "gmail" as const, label: "Gmail", icon: Mail },
    { id: "propostas" as const, label: "Propostas", icon: Send },
    { id: "followup" as const, label: "Follow-up", icon: MessageCircle },
    { id: "historico" as const, label: "Histórico", icon: History },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-indigo-500/20 text-indigo-200"
                : "border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className="size-3.5" />
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

      {tab === "dashboard" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <MetricCard
              label="Sem resposta"
              value={stats ? String(stats.semResposta) : "—"}
              hint="Clientes 7+ dias sem contato"
              hintClassName="text-rose-400/80"
            />
            <MetricCard
              label="Aguardando retorno"
              value={stats ? String(stats.aguardandoRetorno) : "—"}
              hint="Propostas enviadas sem abertura"
              hintClassName="text-amber-400/80"
            />
            <MetricCard
              label="Follow-up pendente"
              value={stats ? String(stats.followUpPendente) : "—"}
              hint="Oportunidades 3+ dias paradas"
              hintClassName="text-violet-400/80"
            />
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Prioridades de hoje</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {staleOpps.length === 0 ? (
                <p className="text-[12px] text-zinc-500">Pipeline em dia — nenhum follow-up urgente.</p>
              ) : (
                <ul className="space-y-2">
                  {staleOpps.slice(0, 5).map((item) => (
                    <li
                      key={item.context.nome + (item.context.orcamentoId ?? item.context.leadId ?? "")}
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
                        onClick={() => {
                          setTab("followup");
                          openFollowUp(item.context);
                        }}
                        className="shrink-0 rounded-md bg-indigo-500/15 px-2 py-1 text-[10px] text-indigo-200"
                      >
                        Follow-up IA
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>
        </div>
      )}

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
                  Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
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
                            <p className="truncate font-medium">
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
                <p className="text-[12px] text-zinc-600">
                  Selecione um e-mail para abrir a conversa.
                </p>
              )}
            </PanelContent>
          </Panel>
        </div>
      )}

      {tab === "propostas" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle>Selecionar proposta</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {propostaOptions.length === 0 ? (
                <p className="text-[12px] text-zinc-500">
                  Nenhuma proposta cadastrada. Crie uma no módulo Alvesz.
                </p>
              ) : (
                <ul className="max-h-[400px] space-y-1.5 overflow-y-auto">
                  {propostaOptions.map((opt) => (
                    <li key={opt.proposta.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPropostaId(opt.proposta.id);
                          setSendEmail(opt.clienteEmail ?? "");
                          setSendSubject(`Proposta Alvesz Experience — ${opt.tipoEvento}`);
                        }}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          selectedPropostaId === opt.proposta.id
                            ? "border-indigo-500/30 bg-indigo-500/10"
                            : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                        }`}
                      >
                        <p className="text-[13px] font-medium text-zinc-200">{opt.clienteNome}</p>
                        <p className="text-[11px] text-zinc-500">
                          {opt.tipoEvento} · {formatBRL(opt.valor)}
                        </p>
                        <p className="text-[10px] text-zinc-600">
                          {formatSafeDate(opt.proposta.created_at.slice(0, 10))}
                          {opt.clienteEmail ? ` · ${opt.clienteEmail}` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Enviar por e-mail</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3 pt-0">
              {selectedProposta ? (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-500">
                  <p className="font-medium text-zinc-300">{selectedProposta.clienteNome}</p>
                  <p>
                    {selectedProposta.tipoEvento} · {formatBRL(selectedProposta.valor)}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-zinc-500">Selecione uma proposta à esquerda.</p>
              )}
              <input
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="E-mail do cliente"
                className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px]"
              />
              <input
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                placeholder="Assunto"
                className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px]"
              />
              <ActionButton
                icon={<Send className="size-3.5" />}
                disabled={actionLoading || !gmailStatus.connected || !selectedPropostaId}
                onClick={() => void sendPropostaEmail()}
              >
                Enviar proposta
              </ActionButton>
              <p className="text-[10px] text-zinc-600">
                Inclui pixel de rastreio para detectar abertura do e-mail.
              </p>
            </PanelContent>
          </Panel>
        </div>
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
                        Gerar IA
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Follow-up inteligente</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {topOpp || followUpContext ? (
                <>
                  <div className="flex gap-1">
                    {(["whatsapp", "instagram", "email"] as FollowUpChannel[]).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          setFollowChannel(ch);
                          const ctx = followUpContext ?? topOpp?.context;
                          if (ctx) setFollowMessage(buildDefaultFollowUpMessages(ctx)[ch]);
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
                    {followChannel === "whatsapp" && (
                      <button
                        type="button"
                        onClick={() => void handleOpenWhatsApp()}
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

      {tab === "historico" && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <History className="size-4 text-indigo-400" />
              Histórico de contatos
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {logs.length === 0 ? (
              <p className="text-[12px] text-zinc-500">
                Nenhum contato registrado ainda. Envie propostas, gere follow-ups ou abra WhatsApp.
              </p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-zinc-200">
                          {COMMS_CHANNEL_LABELS[log.channel]} ·{" "}
                          {log.recipient ?? log.subject ?? "Contato"}
                        </p>
                        <p className="text-[10px] text-zinc-600">
                          <Clock className="mr-1 inline size-3" />
                          {formatSafeDate(log.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${COMMS_STATUS_STYLES[log.status as keyof typeof COMMS_STATUS_STYLES]}`}
                      >
                        {COMMS_STATUS_LABELS[log.status]}
                      </span>
                    </div>
                    {log.body_preview && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                        {log.body_preview}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>
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
