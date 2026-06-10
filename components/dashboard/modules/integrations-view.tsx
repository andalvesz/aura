"use client";

import {
  ArrowRight,
  Clock,
  Loader2,
  RefreshCw,
  ScrollText,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useIntegrationCenter } from "@/hooks/use-integration-center";
import { cn } from "@/utils/cn";
import {
  ACTIVE_INTEGRATIONS,
  COMING_SOON_INTEGRATION_LABELS,
  formatIntegrationCents,
  formatIntegrationDateTime,
  integrationPlatformLabel,
  integrationStatusColor,
  integrationStatusLabel,
  type IntegrationCenterPlatformStatus,
} from "@/utils/integrations";

function PlatformCard({ platform }: { platform: IntegrationCenterPlatformStatus }) {
  const activeDef = ACTIVE_INTEGRATIONS.find((p) => p.id === platform.platform);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-100">{platform.label}</p>
          {platform.accountLabel ? (
            <p className="text-[10px] text-zinc-500">{platform.accountLabel}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-medium",
            integrationStatusColor(platform.status)
          )}
        >
          {integrationStatusLabel(platform.status)}
        </span>
      </div>

      {!platform.comingSoon ? (
        <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
          {platform.platform === "meta" ? (
            <>
              <span>Campanhas: {platform.stats.campaigns ?? 0}</span>
              <span>Contas: {platform.stats.accounts ?? 0}</span>
              <span>Ativas: {platform.stats.activeCampaigns ?? 0}</span>
            </>
          ) : null}
          {platform.platform === "kiwify" ? (
            <>
              <span>Vendas sync: {platform.stats.sales ?? "—"}</span>
              <span>Produtos: {platform.stats.products ?? 0}</span>
              <span>Afiliados: {platform.stats.affiliates ?? 0}</span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="mb-3 text-[10px] text-zinc-500">
          {COMING_SOON_INTEGRATION_LABELS[
            platform.platform as keyof typeof COMING_SOON_INTEGRATION_LABELS
          ]?.description ?? "Integração preparada na arquitetura."}
        </p>
      )}

      {platform.lastError ? (
        <p className="mb-2 text-[10px] text-rose-400">{platform.lastError}</p>
      ) : null}

      {activeDef && !platform.comingSoon ? (
        <Link
          href={activeDef.href}
          className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300"
        >
          Gerenciar conexão
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

export function IntegrationsView() {
  const { dashboard, loading, error, busy, syncAll } = useIntegrationCenter();

  async function handleSyncAll() {
    const err = await syncAll();
    if (err) toast.error(err);
    else toast.success("Sincronização concluída.");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <EmptyState
        title="Integration Center indisponível"
        description={error ?? "Não foi possível carregar as integrações."}
      />
    );
  }

  const activePlatforms = dashboard.connections.filter((c) => !c.comingSoon);
  const comingSoon = dashboard.connections.filter((c) => c.comingSoon);
  const connectedCount = activePlatforms.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita importada"
          value={formatIntegrationCents(dashboard.metrics.importedRevenueCents)}
          hint="Últimos 30 dias (Kiwify)"
        />
        <MetricCard
          label="Comissões"
          value={formatIntegrationCents(dashboard.metrics.commissionsCents)}
          hint="Comissões de afiliados"
        />
        <MetricCard
          label="Campanhas ativas"
          value={String(dashboard.metrics.activeCampaigns)}
          hint="Meta Business"
        />
        <MetricCard
          label="Produtos ativos"
          value={String(dashboard.metrics.activeProducts)}
          hint="Kiwify"
        />
      </div>

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>Sincronização</PanelTitle>
          <ActionButton onClick={() => void handleSyncAll()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar agora
          </ActionButton>
        </PanelHeader>
        <PanelContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="h-3 w-3" />
              Última sincronização
            </p>
            <p className="text-xs text-zinc-200">{formatIntegrationDateTime(dashboard.sync.lastSyncAt)}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="h-3 w-3" />
              Próxima sincronização
            </p>
            <p className="text-xs text-zinc-200">{formatIntegrationDateTime(dashboard.sync.nextSyncAt)}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <AlertTriangle className="h-3 w-3" />
              Erros encontrados
            </p>
            {dashboard.sync.errors.length === 0 ? (
              <p className="text-xs text-emerald-400">Nenhum erro recente</p>
            ) : (
              <ul className="space-y-0.5 text-[10px] text-rose-400">
                {dashboard.sync.errors.slice(0, 3).map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>
            Plataformas conectadas ({connectedCount}/{activePlatforms.length})
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-2 sm:grid-cols-2">
          {activePlatforms.map((platform) => (
            <PlatformCard key={platform.platform} platform={platform} />
          ))}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Em breve</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {comingSoon.map((platform) => (
            <PlatformCard key={platform.platform} platform={platform} />
          ))}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs de integração
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          {dashboard.events.length === 0 ? (
            <p className="text-xs text-zinc-500">Nenhum evento registrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.events.slice(0, 12).map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-white/5 px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-zinc-200">
                      <span className="text-zinc-500">{integrationPlatformLabel(event.platform)} · </span>
                      {event.title}
                    </p>
                    {event.message ? (
                      <p className="text-[10px] text-zinc-500">{event.message}</p>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {formatIntegrationDateTime(event.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
