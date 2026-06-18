"use client";

import {
  Globe,
  Image,
  Languages,
  Layout,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useDecisionEngine } from "@/hooks/use-decision-engine";
import type { UnifiedDecision } from "@/utils/aura-decision-engine";
import { cn } from "@/utils/cn";

const SOURCE_LABELS: Record<string, string> = {
  growth_brain: "Growth Brain",
  revenue_ai: "Revenue AI",
  market_hunter: "Market Hunter",
  operation_center: "Operation Center",
  performance_ai: "Performance AI",
  kiwify: "Kiwify",
  meta: "Meta Ads",
};

function DecisionCard({
  title,
  icon: Icon,
  accent,
  decision,
}: {
  title: string;
  icon: typeof Package;
  accent: string;
  decision: UnifiedDecision | null;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-[13px]">
          <Icon className={cn("size-3.5", accent)} />
          {title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        {decision ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-zinc-100">{decision.label}</p>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                Score {decision.score}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">{decision.reason}</p>
            <p className="text-[10px] text-emerald-400/90">
              Fonte: {SOURCE_LABELS[decision.source] ?? decision.source}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">Sem decisão disponível.</p>
        )}
      </PanelContent>
    </Panel>
  );
}

export function DecisionEngineView() {
  const { decisions, loading, error, refresh } = useDecisionEngine();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Decision Engine atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={2} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Decision Engine" description={error} />;
  }

  if (!decisions) {
    return (
      <EmptyState
        title="Decision Engine vazio"
        description="Conecte Growth Brain, Revenue AI, Market Hunter ou Operation Center."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Decisões unificadas — melhor produto, país, idioma, oferta, criativo e landing
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

      <div className="grid gap-2 sm:grid-cols-2">
        <MetricCard label="Confiança" value={`${decisions.confidence.toFixed(0)}%`} />
        <MetricCard
          label="Fontes usadas"
          value={String(decisions.sourcesUsed.length)}
          hint={decisions.sourcesUsed.map((s) => SOURCE_LABELS[s] ?? s).join(", ")}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DecisionCard
          title="Melhor produto"
          icon={Package}
          accent="text-violet-400"
          decision={decisions.bestProduct}
        />
        <DecisionCard
          title="Melhor país"
          icon={Globe}
          accent="text-cyan-400"
          decision={decisions.bestCountry}
        />
        <DecisionCard
          title="Melhor idioma"
          icon={Languages}
          accent="text-sky-400"
          decision={decisions.bestLanguage}
        />
        <DecisionCard
          title="Melhor oferta"
          icon={Tag}
          accent="text-emerald-400"
          decision={decisions.bestOffer}
        />
        <DecisionCard
          title="Melhor criativo"
          icon={Image}
          accent="text-pink-400"
          decision={decisions.bestCreative}
        />
        <DecisionCard
          title="Melhor landing"
          icon={Layout}
          accent="text-amber-400"
          decision={decisions.bestLanding}
        />
      </div>

      {decisions.bestCampaign ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Megaphone className="size-3.5 text-orange-400" />
              Melhor campanha
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-zinc-100">{decisions.bestCampaign.label}</p>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                Score {decisions.bestCampaign.score}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">{decisions.bestCampaign.reason}</p>
            <p className="flex items-center gap-1 text-[10px] text-emerald-400/90">
              <Sparkles className="size-3" />
              Fonte: {SOURCE_LABELS[decisions.bestCampaign.source] ?? decisions.bestCampaign.source}
            </p>
          </PanelContent>
        </Panel>
      ) : null}
    </div>
  );
}
