"use client";

import { useState } from "react";
import {
  Brain,
  Globe,
  Languages,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useGrowthBrain } from "@/hooks/use-growth-brain";
import type { GrowthBestCard } from "@/utils/growth-brain";

function BestCard({
  title,
  icon: Icon,
  card,
  accent,
}: {
  title: string;
  icon: typeof Brain;
  card: GrowthBestCard | null;
  accent: string;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Icon className={`size-3.5 ${accent}`} />
          {title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        {card ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-zinc-100">{card.label}</p>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                Score {card.score}
              </span>
            </div>
            {card.lesson ? (
              <p className="text-[11px] text-zinc-400">{card.lesson}</p>
            ) : null}
            {card.recommendation ? (
              <p className="text-[11px] text-emerald-400/90">{card.recommendation}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
              {card.metrics.roas != null ? <span>ROAS {card.metrics.roas.toFixed(2)}</span> : null}
              {card.metrics.ctr != null ? <span>CTR {(card.metrics.ctr * 100).toFixed(2)}%</span> : null}
              {card.metrics.revenue != null ? (
                <span>Receita R$ {card.metrics.revenue.toFixed(2)}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">Sem dados suficientes ainda.</p>
        )}
      </PanelContent>
    </Panel>
  );
}

export function GrowthBrainView() {
  const { dashboard, loading, error, refresh } = useGrowthBrain();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Growth Brain atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={3} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Growth Brain" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Growth Brain vazio"
        description="Conecte Performance AI, Revenue Center, Meta ou Kiwify para começar a aprender."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Inteligência de crescimento — cada venda, clique e campanha alimenta o Aura
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

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Memórias ativas" value={String(dashboard.activeMemories)} />
        <MetricCard
          label="ROAS médio"
          value={dashboard.avgRoas != null ? dashboard.avgRoas.toFixed(2) : "—"}
        />
        <MetricCard
          label="CTR médio"
          value={dashboard.avgCtr != null ? `${(dashboard.avgCtr * 100).toFixed(2)}%` : "—"}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <BestCard title="Melhor copy" icon={Type} card={dashboard.melhorCopy} accent="text-sky-400" />
        <BestCard
          title="Melhor criativo"
          icon={Sparkles}
          card={dashboard.melhorCriativo}
          accent="text-violet-400"
        />
        <BestCard
          title="Melhor landing"
          icon={Target}
          card={dashboard.melhorLanding}
          accent="text-cyan-400"
        />
        <BestCard
          title="Melhor campanha"
          icon={Megaphone}
          card={dashboard.melhorCampanha}
          accent="text-fuchsia-400"
        />
        <BestCard
          title="Melhor nicho"
          icon={Brain}
          card={dashboard.melhorNicho}
          accent="text-amber-400"
        />
        <BestCard title="Melhor país" icon={Globe} card={dashboard.melhorPais} accent="text-emerald-400" />
        <BestCard
          title="Melhor idioma"
          icon={Languages}
          card={dashboard.melhorIdioma}
          accent="text-rose-400"
        />
      </div>

      {dashboard.insights.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Insights
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {dashboard.insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-md border border-white/[0.06] px-3 py-2"
              >
                <p className="text-[12px] font-medium text-zinc-200">{insight.title}</p>
                <p className="text-[11px] text-zinc-400">{insight.summary}</p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      ) : null}

      {dashboard.recommendations.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Brain className="size-3.5 text-violet-400" />
              Recomendações
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {dashboard.recommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-white/[0.06] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-zinc-200">{item.title}</p>
                  <span className="text-[10px] uppercase text-zinc-500">{item.priority}</span>
                </div>
                <p className="text-[11px] text-zinc-400">{item.action}</p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      ) : null}
    </div>
  );
}
