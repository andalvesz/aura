"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { useGastos } from "@/hooks/use-gastos";
import { formatBRL, formatDate } from "@/utils/format";
import { computeFinanceStats, getCategoryLabel, ORCAMENTO_MENSAL } from "@/utils/finance";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddGastoModal } from "./add-gasto-modal";

export function FinanceiroView() {
  const { data: gastos, loading, error, create } = useGastos();
  const [modalOpen, setModalOpen] = useState(false);

  const stats = useMemo(() => computeFinanceStats(gastos), [gastos]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setModalOpen(true)}
        >
          Adicionar gasto
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard
            label="Gasto do mês"
            value={formatBRL(stats.totalMonth)}
            hint={`Dia ${stats.dayOfMonth} de ${stats.daysInMonth}`}
          />
          <MetricCard
            label="Maior categoria"
            value={stats.topCategory?.label ?? "—"}
            hint={
              stats.topCategory
                ? `${stats.topCategory.pct}% do total`
                : "Sem gastos"
            }
          />
          <MetricCard
            label="Saldo estimado"
            value={formatBRL(stats.saldo)}
            hint={`Orçamento ${formatBRL(ORCAMENTO_MENSAL)}`}
            hintClassName={
              stats.saldo >= 0 ? "text-emerald-400/90" : "text-red-400/90"
            }
          />
          <MetricCard
            label="Previsão fim do mês"
            value={formatBRL(stats.forecast)}
            hint="Projeção linear"
          />
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Gastos recentes</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : stats.monthGastos.length === 0 ? (
              <EmptyState
                title="Nenhum gasto este mês"
                description="Adicione seu primeiro gasto para acompanhar o orçamento."
                action={
                  <ActionButton onClick={() => setModalOpen(true)}>
                    Adicionar gasto
                  </ActionButton>
                }
              />
            ) : (
              <ul className="space-y-0.5">
                {stats.monthGastos.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="text-[13px] text-zinc-200">{g.titulo}</p>
                      <p className="text-[11px] text-zinc-600">
                        {getCategoryLabel(g.categoria)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-zinc-200">
                        {formatBRL(Number(g.valor))}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {formatDate(g.data)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Por categoria</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2.5 pt-0">
            {loading ? (
              <ListSkeleton rows={6} />
            ) : stats.categories.length === 0 ? (
              <EmptyState title="Sem categorias" description="Adicione gastos para ver o gráfico." />
            ) : (
              stats.categories.map((c) => (
                <div key={c.key}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-zinc-400">{c.label}</span>
                    <span className="text-zinc-600">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${c.color}/70 transition-all duration-500`}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </PanelContent>
        </Panel>
      </div>

      <AddGastoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          const { error } = await create(payload);
          return { error };
        }}
      />
    </div>
  );
}
