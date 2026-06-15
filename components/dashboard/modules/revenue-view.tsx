"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useRevenue } from "@/hooks/use-revenue";
import { cn } from "@/utils/cn";
import { formatBRL } from "@/utils/format";
import type { ExpenseSourceMetrics, RevenueSourceMetrics } from "@/utils/revenue";

function SourceRow({
  item,
  accent,
}: {
  item: RevenueSourceMetrics | ExpenseSourceMetrics;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-zinc-200">{item.label}</p>
        <p className="text-[10px] text-zinc-500">
          Semana {formatBRL(item.week)} · Total {formatBRL(item.total)}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-[13px] font-semibold", accent)}>{formatBRL(item.month)}</p>
        <p className="text-[10px] text-zinc-500">Hoje {formatBRL(item.today)}</p>
      </div>
    </div>
  );
}

export function RevenueView() {
  const { dashboard, loading, error, refresh } = useRevenue();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Dados atualizados.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Aura Revenue Center" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Sem dados financeiros"
        description="Conecte Kiwify, Meta ou registre receitas e despesas para começar."
      />
    );
  }

  const { resumo, lucro, receitas, despesas } = dashboard;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Operação digital · receitas, despesas e lucro consolidados
        </p>
        <ActionButton
          variant="ghost"
          disabled={syncing}
          onClick={() => void handleRefresh()}
        >
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Atualizar
        </ActionButton>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita hoje" value={formatBRL(resumo.today)} />
        <MetricCard label="Receita semana" value={formatBRL(resumo.week)} />
        <MetricCard label="Receita mês" value={formatBRL(resumo.month)} />
        <MetricCard label="Receita total" value={formatBRL(resumo.total)} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ArrowUpRight className="size-3.5 text-emerald-400" />
            Receitas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-1.5">
          {receitas.map((item) => (
            <SourceRow key={item.id} item={item} accent="text-emerald-300" />
          ))}
          <div className="mt-2 flex flex-wrap gap-2 pt-1">
            <Link
              href="/dashboard/platforms/kiwify"
              className="text-[10px] text-violet-400 hover:underline"
            >
              Kiwify →
            </Link>
            <Link
              href="/dashboard/platforms/meta"
              className="text-[10px] text-violet-400 hover:underline"
            >
              Meta Ads →
            </Link>
            <Link
              href="/dashboard/alvesz"
              className="text-[10px] text-violet-400 hover:underline"
            >
              Alvesz →
            </Link>
            <Link
              href="/dashboard/consorcios"
              className="text-[10px] text-violet-400 hover:underline"
            >
              Consórcios →
            </Link>
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ArrowDownRight className="size-3.5 text-rose-400" />
            Despesas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-1.5">
          {despesas.map((item) => (
            <SourceRow key={item.id} item={item} accent="text-rose-300" />
          ))}
          <Link
            href="/dashboard/financeiro"
            className="mt-2 inline-block text-[10px] text-violet-400 hover:underline"
          >
            Registrar despesas no Financeiro →
          </Link>
        </PanelContent>
      </Panel>

      <Panel className="border-emerald-500/15 bg-emerald-500/[0.03]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <TrendingUp className="size-3.5 text-emerald-400" />
            Lucro
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard label="Receita" value={formatBRL(lucro.receita.month)} hint="Mês atual" />
            <MetricCard label="Despesas" value={formatBRL(lucro.despesas.month)} hint="Mês atual" />
            <MetricCard
              label="Lucro líquido"
              value={formatBRL(lucro.lucroLiquido.month)}
              hint="Mês atual"
            />
            <MetricCard label="ROI" value={`${lucro.roiPct}%`} hint="Lucro / despesas" />
            <MetricCard
              label="Investimento"
              value={formatBRL(lucro.investimentoSugerido)}
              hint="≈35% do lucro"
            />
            <MetricCard
              label="Meta Ads sugerido"
              value={formatBRL(lucro.metaAdsSugerido)}
              hint="≈25% do lucro"
            />
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Banknote className="size-3.5 text-violet-400" />
            Money Missions
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          <p className="text-[12px] text-zinc-400">
            O progresso das missões financeiras usa o{" "}
            <span className="font-medium text-emerald-300">lucro líquido</span> como referência
            (não apenas receita bruta).
          </p>
          <Link
            href="/dashboard/money"
            className="mt-2 inline-block text-[11px] text-violet-400 hover:underline"
          >
            Abrir Aura Money Missions →
          </Link>
        </PanelContent>
      </Panel>
    </div>
  );
}
