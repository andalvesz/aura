"use client";

import { Download, ExternalLink, FileText, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import {
  useAlveszEventos,
  useAlveszPropostas,
  useClientes,
  useEstoque,
  useEventos,
  useOrcamentos,
} from "@/hooks";
import type { AlveszEvento, Cliente, EstoqueItem, Orcamento } from "@/types/database";
import {
  calcPrecoSugerido,
  ESTOQUE_STATUS_STYLE,
  estoqueStatus,
} from "@/utils/alvesz";
import { DEFAULT_ALVESZ_PROPOSTA_PDF_META } from "@/utils/alvesz-proposta";
import {
  createCalendarFromAlveszEvento,
  createGrowthLeadFromOrcamento,
  getOrcamentoStatusLabel,
  normalizeOrcamentoStatus,
  ORCAMENTO_STATUSES,
  syncGrowthLeadOnOrcamentoStatus,
  type OrcamentoStatus,
} from "@/utils/alvesz-integration";
import { formatBRL, formatDate } from "@/utils/format";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddOrcamentoModal } from "./add-orcamento-modal";
import { AddClienteModal } from "./add-cliente-modal";
import { AddEstoqueModal } from "./add-estoque-modal";
import { AddAlveszEventoModal } from "./add-alvesz-evento-modal";
import { AlveszPropostaModal } from "./alvesz-proposta-modal";
import { FollowUpModal } from "./follow-up-modal";
import { WhatsAppAssistidoModal } from "./whatsapp-assistido-modal";
import {
  buildFollowUpContextFromOrcamento,
  daysSinceContact,
  getFollowUpIdleTier,
} from "@/utils/follow-up";
import { buildWhatsAppPropostaContext } from "@/utils/whatsapp-ia";

export function AlveszView() {
  const supabase = useMemo(() => createClient(), []);
  const { data: estoque, loading: loadingEstoque, create: createEstoque, update: updateEstoque, remove: removeEstoque } = useEstoque();
  const { data: clientes, loading: loadingClientes, create: createCliente } = useClientes();
  const {
    data: orcamentos,
    loading: loadingOrcamentos,
    create: createOrcamento,
    update: updateOrcamento,
    remove: removeOrcamento,
  } = useOrcamentos();
  const {
    data: eventosAlvesz,
    loading: loadingEventos,
    create: createEventoAlvesz,
    update: updateEventoAlvesz,
    remove: removeEventoAlvesz,
  } = useAlveszEventos();
  const { create: createProposta } = useAlveszPropostas();

  const [orcamentoModal, setOrcamentoModal] = useState(false);
  const [propostaOrcamento, setPropostaOrcamento] = useState<Orcamento | null>(null);
  const [followUpOrcamento, setFollowUpOrcamento] = useState<Orcamento | null>(null);
  const [whatsAppOrcamento, setWhatsAppOrcamento] = useState<Orcamento | null>(null);
  const { create: createEventoCalendario } = useEventos();
  const [clienteModal, setClienteModal] = useState(false);
  const [estoqueModal, setEstoqueModal] = useState(false);
  const [eventoModal, setEventoModal] = useState(false);
  const [editingEstoque, setEditingEstoque] = useState<EstoqueItem | null>(null);
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [convidados, setConvidados] = useState(0);
  const [horas, setHoras] = useState(0);

  const loading =
    loadingEstoque || loadingClientes || loadingOrcamentos || loadingEventos;

  const critical = useMemo(
    () =>
      estoque.filter(
        (i) =>
          estoqueStatus(Number(i.quantidade), Number(i.minimo_alerta)) !== "ok"
      ),
    [estoque]
  );

  const pendentes = orcamentos.filter((o) => {
    const s = normalizeOrcamentoStatus(o.status);
    return s === "rascunho" || s === "enviado" || s === "negociacao";
  });

  const pipelineTotal = pendentes.reduce(
    (s, o) => s + Number(o.valor_total),
    0
  );

  const faturamentoFechado = orcamentos
    .filter((o) => normalizeOrcamentoStatus(o.status) === "fechado")
    .reduce((s, o) => s + Number(o.valor_total), 0);

  const precoSugerido =
    convidados > 0 && horas > 0 ? calcPrecoSugerido(convidados, horas) : 0;

  const followUpOrcamentoContext = useMemo(() => {
    if (!followUpOrcamento) return null;
    const cliente = followUpOrcamento.cliente_id
      ? clientes.find((c) => c.id === followUpOrcamento.cliente_id) ?? null
      : null;
    return buildFollowUpContextFromOrcamento(followUpOrcamento, cliente);
  }, [followUpOrcamento, clientes]);

  const whatsAppOrcamentoContext = useMemo(() => {
    if (!whatsAppOrcamento) return null;
    const cliente = whatsAppOrcamento.cliente_id
      ? clientes.find((c) => c.id === whatsAppOrcamento.cliente_id) ?? null
      : null;
    return buildWhatsAppPropostaContext(whatsAppOrcamento, cliente);
  }, [whatsAppOrcamento, clientes]);

  const whatsAppOrcamentoCliente = useMemo(() => {
    if (!whatsAppOrcamento?.cliente_id) return null;
    return clientes.find((c) => c.id === whatsAppOrcamento.cliente_id) ?? null;
  }, [whatsAppOrcamento, clientes]);

  async function handleCreateOrcamento(payload: {
    cliente_id: string | null;
    tipo_evento: string;
    convidados: number;
    valor_total: number;
    lucro_estimado: number;
    status: string;
    data_evento: string | null;
    local: string | null;
    observacoes: string | null;
    criarLead: boolean;
  }) {
    const result = await createOrcamento({
      cliente_id: payload.cliente_id,
      tipo_evento: payload.tipo_evento,
      convidados: payload.convidados,
      valor_total: payload.valor_total,
      lucro_estimado: payload.lucro_estimado,
      status: payload.status,
      data_evento: payload.data_evento,
      local: payload.local,
      observacoes: payload.observacoes,
    });

    if (result.error) return { error: result.error };

    if (payload.criarLead && result.data) {
      const cliente = payload.cliente_id
        ? clientes.find((c) => c.id === payload.cliente_id) ?? null
        : null;
      const leadResult = await createGrowthLeadFromOrcamento(
        supabase,
        result.data,
        cliente
      );
      if (leadResult.error) {
        toast.info(`Orçamento criado, mas lead não foi criado: ${leadResult.error}`);
      }
    }

    return { error: null };
  }

  async function handleOrcamentoStatusChange(
    orcamento: Orcamento,
    newStatus: OrcamentoStatus
  ) {
    const { error } = await updateOrcamento(orcamento.id, { status: newStatus });
    if (error) {
      toast.error(error);
      return;
    }
    await syncGrowthLeadOnOrcamentoStatus(supabase, orcamento, newStatus);
    toast.success(`Status: ${getOrcamentoStatusLabel(newStatus)}`);
  }

  async function handleCreateEvento(payload: {
    titulo: string;
    data_evento: string;
    local: string | null;
    cliente_id: string | null;
    valor_fechado: number;
  }) {
    const result = await createEventoAlvesz(payload);
    if (result.error) return { error: result.error };

    if (syncCalendar && result.data) {
      const cliente = payload.cliente_id
        ? clientes.find((c) => c.id === payload.cliente_id)
        : null;
      const cal = await createCalendarFromAlveszEvento(supabase, {
        titulo: payload.titulo,
        data_evento: payload.data_evento,
        local: payload.local,
        clienteNome: cliente?.nome,
      });
      if (cal.data?.id) {
        await updateEventoAlvesz(result.data.id, {
          evento_calendario_id: cal.data.id,
        });
      } else if (cal.error) {
        toast.info(`Evento salvo; calendário: ${cal.error}`);
      }
    }

    return { error: null };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setOrcamentoModal(true)}
        >
          Novo orçamento
        </ActionButton>
        <ActionButton onClick={() => setClienteModal(true)}>
          Novo cliente
        </ActionButton>
        <ActionButton onClick={() => setEventoModal(true)}>
          Novo evento
        </ActionButton>
        <ActionButton
          onClick={() => {
            setEditingEstoque(null);
            setEstoqueModal(true);
          }}
        >
          Novo item de estoque
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard
            label="Orçamentos"
            value={String(orcamentos.length)}
            hint={`${pendentes.length} em pipeline`}
          />
          <MetricCard
            label="Pipeline pendente"
            value={formatBRL(pipelineTotal)}
            hint={`${pendentes.length} propostas`}
          />
          <MetricCard
            label="Estoque crítico"
            value={`${critical.length} itens`}
            hint={critical.map((c) => c.produto).join(", ") || "Tudo ok"}
            hintClassName={
              critical.length ? "text-red-400/90" : "text-emerald-400/90"
            }
          />
          <MetricCard
            label="Faturamento fechado"
            value={formatBRL(faturamentoFechado)}
            hint="Orçamentos com status Fechado"
          />
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-3">
        <Panel>
          <PanelHeader>
            <PanelTitle>Clientes</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {loadingClientes ? (
              <ListSkeleton rows={4} />
            ) : clientes.length === 0 ? (
              <EmptyState
                title="Nenhum cliente"
                description="Cadastre clientes da Alvesz Experience."
                action={
                  <ActionButton onClick={() => setClienteModal(true)}>
                    Novo cliente
                  </ActionButton>
                }
              />
            ) : (
              <ul className="max-h-[200px] space-y-2 overflow-y-auto">
                {clientes.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-white/[0.04] p-2 text-[12px]"
                  >
                    <p className="font-medium text-zinc-200">{c.nome}</p>
                    <p className="text-zinc-500">
                      {c.telefone ?? "—"}
                      {c.instagram ? ` · ${c.instagram}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Estoque</PanelTitle>
          </PanelHeader>
          <PanelContent className="overflow-x-auto pt-0">
            {loadingEstoque ? (
              <ListSkeleton rows={5} />
            ) : estoque.length === 0 ? (
              <EmptyState
                title="Estoque vazio"
                description="Cadastre seus primeiros itens de estoque."
                action={
                  <ActionButton
                    onClick={() => {
                      setEditingEstoque(null);
                      setEstoqueModal(true);
                    }}
                  >
                    Novo item
                  </ActionButton>
                }
              />
            ) : (
              <table className="w-full min-w-[220px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-600">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Qtd</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {estoque.map((row) => {
                    const status = estoqueStatus(
                      Number(row.quantidade),
                      Number(row.minimo_alerta)
                    );
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-white/[0.04] text-zinc-300"
                      >
                        <td className="py-2">
                          <button
                            type="button"
                            className="hover:text-zinc-100"
                            onClick={() => {
                              setEditingEstoque(row);
                              setEstoqueModal(true);
                            }}
                          >
                            {row.produto}
                          </button>
                        </td>
                        <td className="py-2 text-zinc-500">
                          {row.quantidade} {row.unidade}
                        </td>
                        <td
                          className={`py-2 capitalize ${ESTOQUE_STATUS_STYLE[status]}`}
                        >
                          {status}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Excluir item?")) return;
                              const { error } = await removeEstoque(row.id);
                              if (error) toast.error(error);
                            }}
                            className="text-zinc-600 hover:text-red-400"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Eventos confirmados</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2 pt-0">
            {loadingEventos ? (
              <ListSkeleton rows={4} />
            ) : eventosAlvesz.length === 0 ? (
              <EmptyState
                title="Nenhum evento"
                description="Cadastre eventos fechados da Alvesz."
                action={
                  <ActionButton onClick={() => setEventoModal(true)}>
                    Novo evento
                  </ActionButton>
                }
              />
            ) : (
              eventosAlvesz.slice(0, 6).map((ev) => (
                <EventoRow
                  key={ev.id}
                  evento={ev}
                  clientes={clientes}
                  onDelete={async () => {
                    if (!confirm("Excluir evento?")) return;
                    const { error } = await removeEventoAlvesz(ev.id);
                    if (error) toast.error(error);
                  }}
                />
              ))
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Orçamentos</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {loadingOrcamentos ? (
            <ListSkeleton rows={4} />
          ) : orcamentos.length === 0 ? (
            <EmptyState
              title="Nenhum orçamento"
              description="Crie seu primeiro orçamento para começar."
              action={
                <ActionButton onClick={() => setOrcamentoModal(true)}>
                  Criar orçamento
                </ActionButton>
              }
            />
          ) : (
            orcamentos.map((o) => {
              const idleTier = getFollowUpIdleTier(daysSinceContact(o.updated_at));
              return (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.04] p-2.5"
              >
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">
                    {o.tipo_evento}
                  </p>
                  <p className="text-[12px] text-violet-300/90">
                    {formatBRL(Number(o.valor_total))}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    {o.cliente_id
                      ? clientes.find((c) => c.id === o.cliente_id)?.nome ??
                        "Cliente"
                      : "Sem cliente"}
                    {o.data_evento ? ` · ${formatDate(o.data_evento)}` : ""}
                    {o.local ? ` · ${o.local}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {idleTier && (
                    <ActionButton
                      icon={<MessageCircle className="size-3.5" />}
                      onClick={() => setFollowUpOrcamento(o)}
                    >
                      Gerar follow-up
                    </ActionButton>
                  )}
                  <ActionButton
                    icon={<ExternalLink className="size-3.5" />}
                    onClick={() => setWhatsAppOrcamento(o)}
                  >
                    Enviar proposta no WhatsApp
                  </ActionButton>
                  <ActionButton
                    icon={<FileText className="size-3.5" />}
                    onClick={() => setPropostaOrcamento(o)}
                  >
                    Proposta
                  </ActionButton>
                  <ActionButton
                    icon={<Download className="size-3.5" />}
                    onClick={() => setPropostaOrcamento(o)}
                  >
                    Gerar PDF
                  </ActionButton>
                  <select
                    value={normalizeOrcamentoStatus(o.status)}
                    onChange={(e) =>
                      handleOrcamentoStatusChange(
                        o,
                        e.target.value as OrcamentoStatus
                      )
                    }
                    className="h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-zinc-300"
                  >
                    {ORCAMENTO_STATUSES.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-900">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Excluir orçamento?")) return;
                      const { error } = await removeOrcamento(o.id);
                      if (error) toast.error(error);
                    }}
                    className="rounded p-1 text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
            })
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Simulador de precificação</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-3 pt-0 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label className="text-zinc-600">
              Convidados
              <input
                type="number"
                min={0}
                value={convidados}
                onChange={(e) => setConvidados(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-zinc-200"
              />
            </label>
            <label className="text-zinc-600">
              Horas
              <input
                type="number"
                min={0}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-zinc-200"
              />
            </label>
          </div>
          <div className="rounded-md bg-violet-500/10 p-2.5">
            <p className="text-[10px] text-zinc-500">Preço sugerido</p>
            <p className="text-xl font-semibold text-zinc-100">
              {precoSugerido > 0 ? formatBRL(precoSugerido) : "—"}
            </p>
            <p className="text-[11px] text-zinc-500">
              {precoSugerido > 0
                ? `Lucro estimado ~${formatBRL(precoSugerido * 0.38)}`
                : "Informe convidados e horas para calcular."}
            </p>
          </div>
        </PanelContent>
      </Panel>

      <AddOrcamentoModal
        open={orcamentoModal}
        onClose={() => setOrcamentoModal(false)}
        clientes={clientes}
        onSubmit={handleCreateOrcamento}
      />
      <AddClienteModal
        open={clienteModal}
        onClose={() => setClienteModal(false)}
        onSubmit={async (payload) => {
          const result = await createCliente({
            ...payload,
            email: null,
            tipo: "pessoa_fisica",
          });
          return { error: result.error };
        }}
      />
      <AddEstoqueModal
        open={estoqueModal}
        onClose={() => {
          setEstoqueModal(false);
          setEditingEstoque(null);
        }}
        initial={editingEstoque}
        onSubmit={async (payload) => {
          if (editingEstoque) {
            const result = await updateEstoque(editingEstoque.id, payload);
            return { error: result.error };
          }
          const result = await createEstoque(payload);
          return { error: result.error };
        }}
      />
      <AddAlveszEventoModal
        open={eventoModal}
        onClose={() => setEventoModal(false)}
        clientes={clientes}
        syncCalendar={syncCalendar}
        onSyncCalendarChange={setSyncCalendar}
        onSubmit={handleCreateEvento}
      />
      <FollowUpModal
        open={followUpOrcamento !== null}
        onClose={() => setFollowUpOrcamento(null)}
        context={followUpOrcamentoContext}
        onScheduleFollowUp={async (payload) => {
          const result = await createEventoCalendario(payload);
          return { error: result.error };
        }}
        onMarkContacted={
          followUpOrcamento
            ? async () => {
                const { error } = await updateOrcamento(followUpOrcamento.id, {
                  local: followUpOrcamento.local,
                });
                return { error };
              }
            : undefined
        }
      />
      {whatsAppOrcamento && whatsAppOrcamentoContext && (
        <WhatsAppAssistidoModal
          open
          onClose={() => setWhatsAppOrcamento(null)}
          title="Enviar proposta no WhatsApp"
          description="Texto profissional com dados do orçamento Alvesz."
          telefone={whatsAppOrcamentoCliente?.telefone}
          intent="proposta"
          context={whatsAppOrcamentoContext}
          onMarkContacted={async () => {
            const { error } = await updateOrcamento(whatsAppOrcamento.id, {
              local: whatsAppOrcamento.local,
            });
            return { error };
          }}
        />
      )}
      <AlveszPropostaModal
        open={propostaOrcamento !== null}
        onClose={() => setPropostaOrcamento(null)}
        orcamento={propostaOrcamento}
        cliente={
          propostaOrcamento?.cliente_id
            ? clientes.find((c) => c.id === propostaOrcamento.cliente_id) ?? null
            : null
        }
        onSave={async (payload) => {
          const result = await createProposta({
            orcamento_id: payload.orcamento_id,
            conteudo: payload.conteudo,
            melhorada_ia: payload.melhorada_ia,
            pdf_meta: payload.pdf_meta ?? DEFAULT_ALVESZ_PROPOSTA_PDF_META,
          });
          return {
            error: result.error,
            data: result.data ? { id: result.data.id } : undefined,
          };
        }}
      />
    </div>
  );
}

function EventoRow({
  evento,
  clientes,
  onDelete,
}: {
  evento: AlveszEvento;
  clientes: Cliente[];
  onDelete: () => void;
}) {
  const nome =
    evento.cliente_id
      ? clientes.find((c) => c.id === evento.cliente_id)?.nome
      : null;

  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-white/[0.04] p-2">
      <div>
        <p className="text-[13px] font-medium text-zinc-200">{evento.titulo}</p>
        <p className="text-[11px] text-zinc-500">
          {formatDate(evento.data_evento)}
          {evento.local ? ` · ${evento.local}` : ""}
          {nome ? ` · ${nome}` : ""}
        </p>
        {Number(evento.valor_fechado) > 0 && (
          <p className="text-[11px] text-violet-300/90">
            {formatBRL(Number(evento.valor_fechado))}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-zinc-600 hover:text-red-400"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
