"use client";

import { useState } from "react";
import {
  Crosshair,
  DollarSign,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Store,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMarketHunter } from "@/hooks/use-market-hunter";
import type { MarketBestCard, MarketOpportunityItem } from "@/utils/market-hunter";

function BestCard({
  title,
  icon: Icon,
  card,
  accent,
}: {
  title: string;
  icon: typeof Target;
  card: MarketBestCard | null;
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
            {card.productName ? (
              <p className="text-[11px] text-zinc-400">Produto: {card.productName}</p>
            ) : null}
            {card.recommendation ? (
              <p className="text-[11px] text-emerald-400/90">{card.recommendation}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">Sem dados suficientes ainda.</p>
        )}
      </PanelContent>
    </Panel>
  );
}

function OpportunityRow({ item }: { item: MarketOpportunityItem }) {
  return (
    <div className="rounded-md border border-white/[0.06] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-200">{item.productName}</p>
          <p className="text-[10px] text-zinc-500">
            {[item.sourcePlatform, item.niche, item.country].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
          {item.score.toFixed(0)}
        </span>
      </div>
      {item.recommendation ? (
        <p className="mt-1 text-[11px] text-zinc-400">{item.recommendation}</p>
      ) : null}
    </div>
  );
}

export function MarketHunterView() {
  const { dashboard, loading, error, refresh, analyze } = useMarketHunter();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Market Hunter atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    setSyncing(true);
    try {
      const ok = await analyze();
      if (ok) toast.success("Análise de mercado concluída.");
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
    return <EmptyState title="Market Hunter" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Market Hunter vazio"
        description="Conecte Growth Brain, Revenue AI, Kiwify ou Operation Center e execute uma análise."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Descoberta automática de oportunidades — responda &quot;Qual produto devo vender agora?&quot;
        </p>
        <div className="flex gap-2">
          <ActionButton variant="ghost" disabled={syncing} onClick={() => void handleRefresh()}>
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Atualizar
          </ActionButton>
          <ActionButton disabled={syncing} onClick={() => void handleAnalyze()}>
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Crosshair className="size-3.5" />
            )}
            Analisar mercado
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Oportunidades" value={String(dashboard.totalOpportunities)} />
        <MetricCard label="Score médio" value={dashboard.scoreMedio.toFixed(1)} />
        <MetricCard label="Watchlist" value={String(dashboard.watchlist.length)} />
      </div>

      {dashboard.report.topRecommendation ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Recomendação principal
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="text-[13px] font-medium text-zinc-100">{dashboard.report.topRecommendation}</p>
            <p className="mt-1 text-[11px] text-zinc-400">{dashboard.report.summary}</p>
          </PanelContent>
        </Panel>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <BestCard
          title="Melhor nicho"
          icon={Layers}
          card={dashboard.melhorNicho}
          accent="text-amber-400"
        />
        <BestCard title="Melhor país" icon={Globe} card={dashboard.melhorPais} accent="text-emerald-400" />
        <BestCard
          title="Melhor moeda"
          icon={DollarSign}
          card={dashboard.melhorMoeda}
          accent="text-sky-400"
        />
        <BestCard
          title="Melhor plataforma"
          icon={Store}
          card={dashboard.melhorPlataforma}
          accent="text-violet-400"
        />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-3.5 text-fuchsia-400" />
            Top oportunidades
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {dashboard.topOportunidades.length > 0 ? (
            dashboard.topOportunidades.map((item) => <OpportunityRow key={item.id} item={item} />)
          ) : (
            <p className="text-[11px] text-zinc-500">
              Execute uma análise para descobrir oportunidades.
            </p>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
