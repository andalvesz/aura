"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Megaphone,
  RefreshCw,
  Shield,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAdsCommander } from "@/hooks/use-ads-commander";
import { cn } from "@/utils/cn";
import {
  AD_PLATFORMS,
  getAdCampaignStatusLabel,
  getAdPlatformLabel,
} from "@/utils/ads-commander";

export function AdsCommanderView() {
  const { dashboard, loading, error, busy, refresh, prepareCampaign, approveCampaign } =
    useAdsCommander();
  const [platform, setPlatform] = useState<"meta" | "google" | "tiktok">("meta");
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Ads Commander atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePrepare() {
    const { message, error: actionError } = await prepareCampaign({ platform });
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  async function handleApprove(campaignId: string) {
    const { message, error: actionError } = await approveCampaign(campaignId);
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
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
    return <EmptyState title="Ads Commander" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Ads Commander vazio"
        description="Prepare uma campanha a partir do Operation Center ou gere diretamente aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Panel>
        <PanelContent className="flex items-start gap-2 py-3">
          <Shield className="size-4 shrink-0 text-amber-400" />
          <p className="text-[11px] text-zinc-400">{dashboard.safeMode.message}</p>
        </PanelContent>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Prepara campanhas Meta, Google e futuras plataformas — aprovação manual obrigatória
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/operation-center">
            <ActionButton variant="ghost" icon={<Target className="size-3.5" />}>
              Operation Center
            </ActionButton>
          </Link>
          <ActionButton variant="ghost" disabled={syncing} onClick={() => void handleRefresh()}>
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Atualizar
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Campanhas preparadas"
          value={String(dashboard.campanhasPreparadas)}
          hint="Pending + ready to publish"
        />
        <MetricCard
          label="Aguardando aprovação"
          value={String(dashboard.campanhasAguardandoAprovacao)}
          hint="Requer ação manual"
        />
        <MetricCard
          label="Orçamento sugerido"
          value={
            dashboard.orcamentoSugerido != null
              ? `R$ ${dashboard.orcamentoSugerido}/dia`
              : "—"
          }
          hint="Revenue AI + budget"
        />
        <MetricCard
          label="Melhor público"
          value={dashboard.melhorPublico ?? "—"}
          hint="Growth Brain + IA"
        />
        <MetricCard
          label="Melhor país"
          value={dashboard.melhorPais ?? "—"}
          hint="Meta Intelligence"
        />
        <MetricCard
          label="Melhor criativo"
          value={dashboard.melhorCriativo ? dashboard.melhorCriativo.slice(0, 40) : "—"}
          hint="Creative Director"
        />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-orange-400" />
            Preparar campanha
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {AD_PLATFORMS.filter((p) => p.id !== "other").map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id as "meta" | "google" | "tiktok")}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[11px] transition-colors",
                  platform === p.id
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                    : "border-white/10 text-zinc-400 hover:bg-white/5"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ActionButton
            icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <TrendingUp className="size-3.5" />}
            onClick={() => void handlePrepare()}
            disabled={busy}
            className="border-orange-500/30"
          >
            Montar campanha completa
          </ActionButton>
          <p className="text-[10px] text-zinc-500">
            Fluxo: campanha → conjuntos → anúncios → risco → orçamento → aguarda aprovação
          </p>
        </PanelContent>
      </Panel>

      {dashboard.riskAnalysis && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Shield className="size-4 text-amber-400" />
              Análise de risco
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="text-[11px] text-zinc-400">
                Risco geral:{" "}
                <span className="font-medium text-zinc-200">
                  {dashboard.riskAnalysis.overall_risk}/100
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Reprovação:{" "}
                <span className="font-medium text-zinc-200">
                  {dashboard.riskAnalysis.rejection_risk}/100
                </span>
              </div>
            </div>
            {dashboard.riskAnalysis.warnings.map((w) => (
              <p key={w} className="text-[11px] text-amber-400/90">
                • {w}
              </p>
            ))}
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-emerald-400" />
            Campanhas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {dashboard.campaigns.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Nenhuma campanha preparada ainda.</p>
          ) : (
            dashboard.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
              >
                <div>
                  <p className="text-[12px] font-medium text-zinc-200">{campaign.campaign_name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {getAdPlatformLabel(campaign.platform)} · {getAdCampaignStatusLabel(campaign.status)} ·{" "}
                    {campaign.ad_sets_count} conjuntos · {campaign.creatives_count} anúncios
                  </p>
                </div>
                {campaign.status === "pending_approval" && (
                  <ActionButton
                    icon={
                      busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      )
                    }
                    onClick={() => void handleApprove(campaign.id)}
                    disabled={busy}
                    className="border-emerald-500/30"
                  >
                    Aprovar Campanha
                  </ActionButton>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
