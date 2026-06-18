"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useFunnelPages } from "@/hooks/use-funnel-pages";
import {
  formatConversionRate,
  FUNNEL_PAGES_SAFE_MODE,
  pageTypeLabel,
  type FunnelPagesBundle,
} from "@/utils/funnel-pages";

function FunnelPagesRow({ bundle }: { bundle: FunnelPagesBundle }) {
  return (
    <div className="rounded-md border border-white/[0.06] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-200">{bundle.funnel.funnel_name}</p>
          <p className="text-[10px] text-zinc-500">
            {bundle.pages.length} páginas · {bundle.landings.length} landings
          </p>
        </div>
        <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
          {formatConversionRate(Number(bundle.funnel.expected_conversion ?? 0))}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {bundle.pages.map((page) => (
          <span
            key={page.id}
            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400"
          >
            {pageTypeLabel(page.page_type)}: {page.status}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FunnelPagesView() {
  const { dashboard, bundles, loading, error, busy, refresh, generate, publish } = useFunnelPages();
  const [syncing, setSyncing] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");

  const funnelOptions = useMemo(
    () =>
      bundles.map((bundle) => ({
        id: bundle.funnel.id,
        label: bundle.funnel.funnel_name,
      })),
    [bundles]
  );

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Funnel Pages atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerate() {
    const funnelId = selectedFunnelId || funnelOptions[0]?.id;
    if (!funnelId) {
      toast.error("Gere um funil no Funnel Engine antes de criar páginas.");
      return;
    }

    const bundle = bundles.find((item) => item.funnel.id === funnelId);
    setSyncing(true);
    try {
      const ok = await generate({
        funnel_id: funnelId,
        product_id: bundle?.funnel.product_id ?? null,
        operation_id: bundle?.funnel.operation_id ?? null,
      });
      if (ok) toast.success("Páginas do funil geradas.");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePublish() {
    const funnelId = selectedFunnelId || funnelOptions[0]?.id;
    if (!funnelId) {
      toast.error("Selecione um funil com páginas geradas.");
      return;
    }

    setSyncing(true);
    try {
      const result = await publish(funnelId);
      if (!result) return;

      const publishedCount = result.pages.filter(
        (page) => page.status === "published" || page.status === "already_published"
      ).length;

      if (result.status === "published") {
        toast.success(`Funil publicado — ${publishedCount} páginas ao vivo.`);
      } else if (result.status === "partial") {
        toast.warning(`Publicação parcial — ${publishedCount}/${result.pages.length} páginas.`);
      } else {
        toast.error("Nenhuma página foi publicada.");
      }
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Funnel Pages Pro" description={error} />;
  }

  const bestPage = dashboard?.bestPage;

  return (
    <div className="space-y-3">
      {FUNNEL_PAGES_SAFE_MODE.active ? (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          {FUNNEL_PAGES_SAFE_MODE.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Geração automática de todas as páginas do funil — front-end, bumps, upsells, downsells e
          thank you.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {funnelOptions.length > 0 ? (
            <select
              value={selectedFunnelId || funnelOptions[0]?.id || ""}
              onChange={(event) => setSelectedFunnelId(event.target.value)}
              className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5 text-[11px] text-zinc-200"
            >
              {funnelOptions.map((option) => (
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
            Gerar páginas
          </ActionButton>
          <ActionButton
            disabled={syncing || busy || funnelOptions.length === 0}
            onClick={() => void handlePublish()}
          >
            {syncing || busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Rocket className="size-3.5" />
            )}
            Publicar funil
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Páginas criadas" value={String(dashboard?.totalPages ?? 0)} />
        <MetricCard label="Páginas publicadas" value={String(dashboard?.publishedPages ?? 0)} />
        <MetricCard
          label="Conversão prevista"
          value={formatConversionRate(dashboard?.expectedConversion ?? 0)}
        />
        <MetricCard
          label="Melhor página do funil"
          value={bestPage ? bestPage.label.slice(0, 24) : "—"}
        />
      </div>

      {bestPage ? (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Melhor página do funil
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="text-[13px] font-medium text-zinc-100">{bestPage.label}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {pageTypeLabel(bestPage.pageType)} · meta {formatConversionRate(bestPage.conversionGoal)} · /{bestPage.slug}
            </p>
          </PanelContent>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <FileText className="size-3.5 text-violet-400" />
            Funis com páginas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {bundles.length > 0 ? (
            bundles.map((bundle) => <FunnelPagesRow key={bundle.funnel.id} bundle={bundle} />)
          ) : (
            <div className="space-y-2 text-[11px] text-zinc-500">
              <p className="flex items-center gap-1.5">
                <Target className="size-3 text-zinc-600" />
                Nenhuma página gerada. O fluxo automático é: Produto → Offer Engine → Funnel Engine → Funnel Pages → Landing Factory.
              </p>
              <p className="flex items-center gap-1.5">
                <Globe className="size-3 text-zinc-600" />
                Gere um funil e stack de ofertas primeiro, ou selecione um funil existente.
              </p>
            </div>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
