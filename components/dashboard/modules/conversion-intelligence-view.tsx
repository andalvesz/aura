"use client";

import { useState } from "react";
import {
  Brain,
  Globe,
  Image,
  Languages,
  Layers,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useConversionIntelligence } from "@/hooks/use-conversion-intelligence";
import {
  CONVERSION_INTELLIGENCE_SAFE_MODE,
  formatConversionPct,
  type ConversionBestCard,
} from "@/utils/conversion-intelligence";

function BestCard({
  title,
  icon: Icon,
  card,
  accent,
}: {
  title: string;
  icon: typeof Brain;
  card: ConversionBestCard | null;
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
                {card.score}% conf.
              </span>
            </div>
            {card.insight ? <p className="text-[11px] text-zinc-400">{card.insight}</p> : null}
            {card.recommendation ? (
              <p className="text-[11px] text-emerald-400/90">{card.recommendation}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
              {card.conversionRate != null ? (
                <span>Conv. {formatConversionPct(card.conversionRate)}</span>
              ) : null}
              {card.roas != null ? <span>ROAS {card.roas.toFixed(2)}</span> : null}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">Sem dados suficientes ainda.</p>
        )}
      </PanelContent>
    </Panel>
  );
}

export function ConversionIntelligenceView() {
  const { dashboard, recommendations, loading, error, busy, refresh, analyze } =
    useConversionIntelligence();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Conversion Intelligence atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    setSyncing(true);
    try {
      const ok = await analyze({ force_refresh: true });
      if (ok) toast.success("Análise de conversão concluída.");
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
    return <EmptyState title="Conversion Intelligence" description={error} />;
  }

  return (
    <div className="space-y-3">
      {CONVERSION_INTELLIGENCE_SAFE_MODE.active ? (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          {CONVERSION_INTELLIGENCE_SAFE_MODE.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          IA que aprende padrões reais de conversão — integra Growth Brain, Revenue AI, Funnel
          Analytics, Decision Engine, Performance AI e Market Hunter.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="ghost" disabled={syncing || busy} onClick={() => void handleRefresh()}>
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Atualizar
          </ActionButton>
          <ActionButton disabled={syncing || busy} onClick={() => void handleAnalyze()}>
            {syncing || busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Analisar conversões
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Insights" value={String(dashboard?.totalInsights ?? 0)} />
        <MetricCard label="Padrões vencedores" value={String(dashboard?.winningPatterns ?? 0)} />
        <MetricCard label="Padrões perdedores" value={String(dashboard?.losingPatterns ?? 0)} />
        <MetricCard
          label="Confiança média"
          value={dashboard?.avgConfidence ? `${dashboard.avgConfidence}%` : "—"}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <BestCard
          title="Melhor headline"
          icon={Type}
          card={dashboard?.melhorHeadline ?? null}
          accent="text-violet-400"
        />
        <BestCard
          title="Melhor criativo"
          icon={Image}
          card={dashboard?.melhorCriativo ?? null}
          accent="text-pink-400"
        />
        <BestCard
          title="Melhor landing"
          icon={LayoutTemplate}
          card={dashboard?.melhorLanding ?? null}
          accent="text-cyan-400"
        />
        <BestCard
          title="Melhor oferta"
          icon={Tag}
          card={dashboard?.melhorOferta ?? null}
          accent="text-emerald-400"
        />
        <BestCard
          title="Melhor país"
          icon={Globe}
          card={dashboard?.melhorPais ?? null}
          accent="text-sky-400"
        />
        <BestCard
          title="Melhor idioma"
          icon={Languages}
          card={dashboard?.melhorIdioma ?? null}
          accent="text-amber-400"
        />
        <BestCard
          title="Melhor estrutura de funil"
          icon={Layers}
          card={dashboard?.melhorEstruturaFunil ?? null}
          accent="text-fuchsia-400"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Brain className="size-3.5 text-emerald-400" />
              Por que converteu?
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="text-[12px] text-zinc-300">
              {dashboard?.whyConverted ?? "Execute a análise para descobrir os padrões vencedores."}
            </p>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Brain className="size-3.5 text-rose-400" />
              Por que não converteu?
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="text-[12px] text-zinc-300">
              {dashboard?.whyNotConverted ??
                "Execute a análise para identificar gargalos de conversão."}
            </p>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Recomendações</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {recommendations.length > 0 ? (
            recommendations.map((item) => (
              <div key={item.id} className="rounded-md border border-white/[0.06] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-medium text-zinc-200">{item.title}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      item.priority === "high"
                        ? "bg-rose-500/10 text-rose-400"
                        : item.priority === "medium"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-white/[0.04] text-zinc-400"
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">{item.action}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Confiança {item.confidence}% · {item.patternType}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-zinc-500">
              Nenhuma recomendação ainda. Clique em Analisar conversões.
            </p>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
