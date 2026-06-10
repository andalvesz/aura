"use client";

import {
  Copy,
  Loader2,
  Pause,
  Play,
  Plug,
  RefreshCw,
  Sparkles,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMetaConnect } from "@/hooks/use-meta-connect";
import {
  INTEGRATION_SECURITY_RULES,
  META_STATUS_LABELS,
  formatIntegrationCents,
} from "@/utils/integrations";

export function MetaConnectView() {
  const {
    connection,
    adAccounts,
    campaigns,
    metricsMap,
    activeCampaigns,
    pausedCampaigns,
    loading,
    error,
    busy,
    connect,
    disconnect,
    sync,
    runAction,
  } = useMetaConnect();

  const [accessToken, setAccessToken] = useState("");
  const [businessName, setBusinessName] = useState("");

  const connected = connection?.status === "connected";

  async function handleConnect() {
    const err = await connect({ accessToken, businessName });
    if (err) toast.error(err);
    else toast.success("Meta Business conectado.");
  }

  async function handleAction(
    campaignId: string,
    action: "start" | "pause" | "resume" | "duplicate" | "generate_copy" | "generate_creative",
    needsApproval = false
  ) {
    const result = await runAction(campaignId, action, needsApproval);
    if (result?.error) {
      if (result.requiresApproval) {
        toast.message("Aprovação necessária", {
          description: "Confirme para executar ações sensíveis na Meta.",
        });
      } else {
        toast.error(result.error);
      }
      return;
    }
    toast.success("Ação executada.");
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
    return <EmptyState title="Meta Connect" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Status" value={connected ? "Conectado" : "Desconectado"} />
        <MetricCard label="Contas de anúncio" value={String(adAccounts.length)} />
        <MetricCard label="Campanhas ativas" value={String(activeCampaigns)} />
        <MetricCard label="Campanhas pausadas" value={String(pausedCampaigns)} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Conexão Meta Business</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          {!connected ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="password"
                placeholder="Access Token (long-lived)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200"
              />
              <input
                type="text"
                placeholder="Nome do Business (opcional)"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200"
              />
              <ActionButton disabled={busy} onClick={() => void handleConnect()}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Plug className="size-3" />}
                Conectar Meta Business
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ActionButton disabled={busy} onClick={() => void sync().then((e) => e && toast.error(e))}>
                <RefreshCw className="size-3" /> Sincronizar
              </ActionButton>
              <ActionButton variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                <Unplug className="size-3" /> Desconectar
              </ActionButton>
            </div>
          )}
          <ul className="text-[10px] text-zinc-500 space-y-1">
            {INTEGRATION_SECURITY_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </PanelContent>
      </Panel>

      {adAccounts.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Contas de anúncio</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {adAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
              >
                {account.name} · {account.currency} · {account.external_account_id}
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Campanhas Meta</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              Conecte e sincronize para listar campanhas.
            </p>
          ) : (
            campaigns.map((campaign) => {
              const metrics = metricsMap[campaign.id];
              return (
                <div
                  key={campaign.id}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-medium text-zinc-200">{campaign.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {META_STATUS_LABELS[campaign.status] ?? campaign.status}
                        {campaign.aura_created ? " · Aura" : ""}
                        {campaign.requires_approval ? " · requer aprovação" : ""}
                      </p>
                    </div>
                  </div>
                  {metrics && (
                    <div className="mb-2 grid grid-cols-2 gap-1 text-[10px] text-zinc-400 sm:grid-cols-5">
                      <span>CTR {metrics.ctr}%</span>
                      <span>CPA {formatIntegrationCents(Math.round(metrics.cpa * 100), campaign.currency)}</span>
                      <span>ROAS {metrics.roas}x</span>
                      <span>Gasto {formatIntegrationCents(metrics.spend_cents, campaign.currency)}</span>
                      <span>Orç. {metrics.budget_spent_pct}%</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "start", true)}
                    >
                      <Play className="size-3" /> Iniciar
                    </ActionButton>
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "pause")}
                    >
                      <Pause className="size-3" /> Pausar
                    </ActionButton>
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "resume", true)}
                    >
                      <RefreshCw className="size-3" /> Retomar
                    </ActionButton>
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "duplicate")}
                    >
                      <Copy className="size-3" /> Duplicar
                    </ActionButton>
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "generate_copy")}
                    >
                      <Sparkles className="size-3" /> Nova copy
                    </ActionButton>
                    <ActionButton
                      className="!h-7 px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAction(campaign.id, "generate_creative")}
                    >
                      <Sparkles className="size-3" /> Novo criativo
                    </ActionButton>
                  </div>
                </div>
              );
            })
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
