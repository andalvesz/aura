"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import { useOfferEngine } from "@/hooks/use-offer-engine";
import type { OfferBestCard, OfferStackBundle } from "@/utils/offer-engine";

function BestOfferCard({
  title,
  icon: Icon,
  card,
  accent,
}: {
  title: string;
  icon: typeof TrendingUp;
  card: OfferBestCard | null;
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
            <p className="text-[13px] font-medium text-zinc-100">{card.label}</p>
            <p className="text-[11px] text-zinc-400">
              R$ {card.price.toFixed(2)} · take {Math.round(card.takeRate * 100)}% · receita esperada R${" "}
              {card.expectedRevenue.toFixed(2)}
            </p>
            {card.rationale ? (
              <p className="text-[11px] text-emerald-400/90">{card.rationale}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">Sem dados suficientes ainda.</p>
        )}
      </PanelContent>
    </Panel>
  );
}

function StackRow({ stack }: { stack: OfferStackBundle }) {
  return (
    <div className="rounded-md border border-white/[0.06] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-200">
            Produto {stack.product_id.slice(0, 8)}…
          </p>
          <p className="text-[10px] text-zinc-500">
            {stack.metrics.strategy.label} · {stack.metrics.totalOffers} ofertas
          </p>
        </div>
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
          AOV R$ {stack.metrics.expectedAov.toFixed(2)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {stack.offers.map((offer) => (
          <span
            key={offer.id}
            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400"
          >
            {offer.offer_type}: R$ {Number(offer.price).toFixed(0)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function OfferEngineView() {
  const { dashboard, stacks, loading, error, busy, refresh, generate } = useOfferEngine();
  const { bundles: creatorBundles } = useCreator();
  const [syncing, setSyncing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");

  const productOptions = useMemo(
    () =>
      creatorBundles.map((bundle) => ({
        id: bundle.product.id,
        label: bundle.product.nome ?? bundle.product.id.slice(0, 8),
      })),
    [creatorBundles]
  );

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Offer Engine atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerate() {
    const productId = selectedProductId || productOptions[0]?.id;
    if (!productId) {
      toast.error("Cadastre um produto no Creator antes de gerar ofertas.");
      return;
    }

    setSyncing(true);
    try {
      const ok = await generate({ product_id: productId });
      if (ok) toast.success("Stack de ofertas gerada.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={6} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Offer Engine Pro" description={error} />;
  }

  const topFunnelRevenue = dashboard?.expectedRevenueByFunnel[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Monetização automática — bumps, upsells, downsells, VIP e continuidade por produto.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {productOptions.length > 0 ? (
            <select
              value={selectedProductId || productOptions[0]?.id || ""}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5 text-[11px] text-zinc-200"
            >
              {productOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          <ActionButton variant="ghost" disabled={syncing || busy} onClick={() => void handleRefresh()}>
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Atualizar
          </ActionButton>
          <ActionButton disabled={syncing || busy} onClick={() => void handleGenerate()}>
            {syncing || busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Gerar stack
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="AOV esperado"
          value={`R$ ${(dashboard?.expectedAov ?? 0).toFixed(2)}`}
        />
        <MetricCard
          label="Ticket médio esperado"
          value={`R$ ${(dashboard?.expectedAverageTicket ?? 0).toFixed(2)}`}
        />
        <MetricCard
          label="Receita esperada por funil"
          value={
            topFunnelRevenue
              ? `R$ ${topFunnelRevenue.revenue.toFixed(2)}`
              : "—"
          }
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <BestOfferCard
          title="Melhor estrutura de oferta"
          icon={Layers}
          card={dashboard?.bestOfferStructure ?? null}
          accent="text-violet-400"
        />
        <BestOfferCard
          title="Melhor upsell"
          icon={ArrowUpCircle}
          card={dashboard?.bestUpsell ?? null}
          accent="text-emerald-400"
        />
        <BestOfferCard
          title="Melhor downsell"
          icon={ArrowDownCircle}
          card={dashboard?.bestDownsell ?? null}
          accent="text-amber-400"
        />
      </div>

      {topFunnelRevenue ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <CircleDollarSign className="size-3.5 text-emerald-400" />
              Top funil por receita esperada
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="text-[13px] font-medium text-zinc-100">{topFunnelRevenue.funnelName}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              R$ {topFunnelRevenue.revenue.toFixed(2)} · {topFunnelRevenue.offerCount} ofertas
            </p>
          </PanelContent>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>Stacks de ofertas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {stacks.length > 0 ? (
            stacks.map((stack) => (
              <StackRow
                key={`${stack.product_id}:${stack.funnel_id ?? "none"}`}
                stack={stack}
              />
            ))
          ) : (
            <p className="text-[11px] text-zinc-500">
              Nenhuma stack gerada. Selecione um produto e clique em Gerar stack.
            </p>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
