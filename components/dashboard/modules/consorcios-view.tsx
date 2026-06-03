"use client";

import { Banknote, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useFinancialIncome } from "@/hooks/use-financial-income";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { useLeads } from "@/hooks/use-leads";
import {
  computeLeadFunnel,
  filterLeadsToday,
  getLeadStatusLabel,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/utils/consorcios";
import { formatTime } from "@/utils/format";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddLeadModal } from "./add-lead-modal";
import { AddReceitaModal } from "./add-receita-modal";

const SCRIPT = `Olá, [nome]! Sou Anderson da Alvesz. Vi seu interesse em consórcio — posso te mostrar uma simulação personalizada em 2 minutos? Temos condições especiais para contemplação rápida.`;

export function ConsorciosView() {
  const { data: leads, loading, create, update } = useLeads();
  const { create: createIncome } = useFinancialIncome();
  const [modalOpen, setModalOpen] = useState(false);
  const [comissaoModalOpen, setComissaoModalOpen] = useState(false);

  const funnel = useMemo(() => computeLeadFunnel(leads), [leads]);
  const leadsToday = useMemo(() => filterLeadsToday(leads), [leads]);

  const propostas = leads.filter((l) => l.status === "proposta").length;
  const fechados = leads.filter((l) => l.status === "fechado").length;

  async function moveLead(id: string, status: LeadStatus) {
    const { error } = await update(id, { status });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Status: ${getLeadStatusLabel(status)}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <ActionButton
          icon={<Banknote className="size-3.5" />}
          onClick={() => setComissaoModalOpen(true)}
        >
          Comissão recebida
        </ActionButton>
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setModalOpen(true)}
        >
          Novo lead
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard label="Total leads" value={String(leads.length)} hint="Pipeline" />
          <MetricCard label="Propostas" value={String(propostas)} />
          <MetricCard label="Leads hoje" value={String(leadsToday.length)} />
          <MetricCard
            label="Fechados"
            value={String(fechados)}
            hintClassName="text-emerald-400/90"
          />
        </div>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Pipeline</PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          {loading ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ListSkeleton key={i} rows={3} />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              title="Pipeline vazio"
              description="Adicione leads para gerenciar seu funil."
              action={
                <ActionButton onClick={() => setModalOpen(true)}>
                  Novo lead
                </ActionButton>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {LEAD_STATUSES.map((col) => {
                const colLeads = leads.filter((l) => l.status === col.value);
                return (
                  <div
                    key={col.value}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-medium text-zinc-300">
                        {col.label}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {colLeads.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
                      {colLeads.map((lead) => (
                        <li
                          key={lead.id}
                          className="rounded-md border border-white/[0.04] bg-zinc-900/50 p-2"
                        >
                          <p className="text-[12px] font-medium text-zinc-200">
                            {lead.nome}
                          </p>
                          <p className="text-[10px] text-zinc-600">{lead.origem}</p>
                          <select
                            value={lead.status}
                            onChange={(e) =>
                              moveLead(lead.id, e.target.value as LeadStatus)
                            }
                            className="mt-1.5 h-7 w-full rounded border border-white/[0.06] bg-transparent px-1 text-[10px] text-zinc-400"
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s.value} value={s.value} className="bg-zinc-900">
                                → {s.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-2 lg:grid-cols-3">
        <Panel>
          <PanelHeader>
            <PanelTitle>Funil</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2 pt-0">
            {funnel.map((step) => (
              <div key={step.status}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">{step.stage}</span>
                  <span className="text-zinc-500">{step.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500/70 to-amber-400/50 transition-all duration-500"
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Leads do dia</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1 pt-0">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : leadsToday.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-zinc-600">
                Nenhum lead cadastrado hoje.
              </p>
            ) : (
              leadsToday.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="text-[13px] text-zinc-200">{lead.nome}</p>
                    <p className="text-[11px] text-zinc-600">{lead.origem}</p>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {formatTime(lead.created_at)}
                  </span>
                </div>
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Script de abordagem</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <p className="rounded-md border border-white/[0.04] bg-white/[0.02] p-3 text-[12px] leading-relaxed text-zinc-400">
              {SCRIPT}
            </p>
          </PanelContent>
        </Panel>
      </div>

      <AddLeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          const result = await create(payload);
          return { error: result.error };
        }}
      />
      <AddReceitaModal
        open={comissaoModalOpen}
        onClose={() => setComissaoModalOpen(false)}
        defaultOrigem="consorcios"
        onSubmit={async (payload) => {
          const { error } = await createIncome({
            ...payload,
            orcamento_id: null,
          });
          return { error };
        }}
      />
    </div>
  );
}
