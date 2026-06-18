"use client";

import { useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Globe,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useRevenueAi } from "@/hooks/use-revenue-ai";
import { cn } from "@/utils/cn";
import { formatBRL } from "@/utils/format";
import type { RevenueChartPoint } from "@/utils/revenue-ai";

function BarChart({
  title,
  points,
  accent = "bg-emerald-500/70",
}: {
  title: string;
  points: RevenueChartPoint[];
  accent?: string;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <BarChart3 className="size-3.5 text-emerald-400" />
          {title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-2">
        {points.length === 0 ? (
          <p className="text-[11px] text-zinc-500">Sem dados para exibir.</p>
        ) : (
          points.slice(0, 12).map((point) => (
            <div key={`${title}-${point.label}`}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-zinc-400">{point.label}</span>
                <span className="text-zinc-500">{formatBRL(point.value)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", accent)}
                  style={{ width: `${point.pct}%` }}
                />
              </div>
            </div>
          ))
        )}
      </PanelContent>
    </Panel>
  );
}

function SparklineChart({
  title,
  points,
}: {
  title: string;
  points: RevenueChartPoint[];
}) {
  const visible = points.slice(-14);
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <TrendingUp className="size-3.5 text-sky-400" />
          {title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <div className="flex h-24 items-end gap-0.5">
          {visible.map((point) => (
            <div
              key={`${title}-${point.label}`}
              className="flex-1 rounded-t bg-emerald-500/60 transition-all"
              style={{ height: `${Math.max(point.pct, 4)}%` }}
              title={`${point.label}: ${formatBRL(point.value)}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">
          Total: {formatBRL(visible.reduce((sum, p) => sum + p.value, 0))}
        </p>
      </PanelContent>
    </Panel>
  );
}

export function RevenueAiView() {
  const { dashboard, forecast, loading, error, refresh, generateForecast } = useRevenueAi();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Revenue AI atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerateForecast() {
    setSyncing(true);
    try {
      const { error: genError, message } = await generateForecast();
      if (genError) {
        toast.error(genError);
        return;
      }
      toast.success(message ?? "Previsão gerada.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Revenue AI" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Revenue AI vazio"
        description="Conecte Kiwify, Meta ou registre vendas para iniciar a inteligência financeira."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Inteligência financeira e comercial — cada venda alimenta o Aura
        </p>
        <ActionButton variant="ghost" disabled={syncing} onClick={() => void handleRefresh()}>
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Atualizar
        </ActionButton>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita Total" value={formatBRL(dashboard.receitaTotal)} />
        <MetricCard label="Lucro Total" value={formatBRL(dashboard.lucroTotal)} />
        <MetricCard
          label="ROAS Médio"
          value={dashboard.roasMedio != null ? `${dashboard.roasMedio.toFixed(2)}x` : "—"}
        />
        <MetricCard
          label="ROI Médio"
          value={dashboard.roiMedio != null ? `${dashboard.roiMedio.toFixed(1)}%` : "—"}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Wallet className="size-3.5 text-violet-400" />
              Melhor Produto
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {dashboard.melhorProduto ? (
              <div>
                <p className="text-[13px] font-medium text-zinc-100">{dashboard.melhorProduto.label}</p>
                <p className="text-[12px] text-emerald-400">{formatBRL(dashboard.melhorProduto.value)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">Sem dados.</p>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Globe className="size-3.5 text-cyan-400" />
              Melhor País
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {dashboard.melhorPais ? (
              <div>
                <p className="text-[13px] font-medium text-zinc-100">{dashboard.melhorPais.label}</p>
                <p className="text-[12px] text-emerald-400">{formatBRL(dashboard.melhorPais.value)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">Sem dados.</p>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <CircleDollarSign className="size-3.5 text-emerald-400" />
              Melhor Plataforma
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {dashboard.melhorPlataforma ? (
              <div>
                <p className="text-[13px] font-medium text-zinc-100">
                  {dashboard.melhorPlataforma.label}
                </p>
                <p className="text-[12px] text-emerald-400">
                  {formatBRL(dashboard.melhorPlataforma.value)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">Sem dados.</p>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Receita por Moeda</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {dashboard.receitaPorMoeda.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Sem dados.</p>
            ) : (
              dashboard.receitaPorMoeda.map((item) => (
                <div key={item.label} className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-200">{formatBRL(item.value)}</span>
                </div>
              ))
            )}
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <SparklineChart title="Receita 30 dias" points={dashboard.chartReceita30Dias} />
        <SparklineChart title="Receita 90 dias" points={dashboard.chartReceita90Dias} />
        <BarChart title="Receita por país" points={dashboard.chartReceitaPorPais} accent="bg-cyan-500/70" />
        <BarChart
          title="Receita por plataforma"
          points={dashboard.chartReceitaPorPlataforma}
          accent="bg-violet-500/70"
        />
      </div>

      {forecast ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Previsão mensal</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCard label="Receita prevista" value={formatBRL(forecast.predictedRevenue)} />
              <MetricCard label="Lucro previsto" value={formatBRL(forecast.predictedProfit)} />
              <MetricCard label="Confiança" value={`${forecast.confidence.toFixed(0)}%`} />
            </div>
            <p className="text-[11px] text-zinc-400">{forecast.recommendation}</p>
          </PanelContent>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader>
            <PanelTitle>Previsão mensal</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">Nenhuma previsão salva. Gere uma nova previsão.</p>
            <ActionButton variant="ghost" disabled={syncing} onClick={() => void handleGenerateForecast()}>
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <TrendingUp className="size-3.5" />
              )}
              Gerar previsão
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {dashboard.insights.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Insights financeiros</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {dashboard.insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-md border border-white/[0.06] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-zinc-200">{insight.title}</p>
                  <span className="text-[10px] uppercase text-zinc-500">{insight.priority}</span>
                </div>
                <p className="text-[11px] text-zinc-400">{insight.summary}</p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      ) : null}
    </div>
  );
}
