"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Eye,
  Loader2,
  Plug,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Unplug,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMetaIntelligence } from "@/hooks/use-meta-intelligence";
import {
  INTEGRATION_SECURITY_RULES,
  META_STATUS_LABELS,
  formatIntegrationCents,
  formatIntegrationDateTime,
} from "@/utils/integrations";
import { META_READ_ONLY_MODE } from "@/utils/meta-intelligence";

function EntityList<T extends { id: string }>({
  items,
  emptyLabel,
  renderItem,
}: {
  items: T[];
  emptyLabel: string;
  renderItem: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-[11px] text-zinc-500">{emptyLabel}</p>;
  }
  return <div className="space-y-2">{items.map((item) => renderItem(item))}</div>;
}

function EntityRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300">
      <p className="font-medium text-zinc-200">{title}</p>
      <p className="text-[10px] text-zinc-500">{subtitle}</p>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  generate_creative: "Gerar criativo",
  generate_copy: "Gerar copy",
  suggest_pause: "Sugerir pausa",
  suggest_scale: "Sugerir escala",
};

export function MetaIntelligenceView() {
  const {
    connection,
    campaigns,
    metricsMap,
    businessManagers,
    pages,
    pixels,
    audiences,
    adSets,
    ads,
    metrics,
    insights,
    recommendations,
    revenueCross,
    readOnly,
    loading,
    error,
    busy,
    syncIntervalHours,
    connect,
    disconnect,
    sync,
    analyze,
  } = useMetaIntelligence();

  const [accessToken, setAccessToken] = useState("");
  const [businessName, setBusinessName] = useState("");

  const connected = connection?.status === "connected";
  const isReadOnly = readOnly || META_READ_ONLY_MODE;
  const perf = metrics?.performance;

  async function handleConnect() {
    const err = await connect({ accessToken, businessName });
    if (err) toast.error(err);
    else toast.success("Meta Business conectado.");
  }

  async function handleSync() {
    const err = await sync();
    if (err) toast.error(err);
    else toast.success("Dados Meta sincronizados.");
  }

  async function handleAnalyze() {
    const err = await analyze();
    if (err) toast.error(err);
    else toast.success("Análise de performance atualizada.");
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
    return <EmptyState title="Meta Intelligence" description={error} />;
  }

  return (
    <div className="space-y-3">
      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200">
          <Eye className="size-3.5 shrink-0" />
          <span>
            <strong>Autopilot em modo preparação</strong> — a Aura sugere ações, mas não executa
            sem sua aprovação.
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="CTR" value={`${perf?.ctr ?? 0}%`} />
        <MetricCard label="CPC" value={`R$ ${(perf?.cpc ?? 0).toFixed(2)}`} />
        <MetricCard label="CPM" value={`R$ ${(perf?.cpm ?? 0).toFixed(2)}`} />
        <MetricCard label="CPA" value={`R$ ${(perf?.cpa ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="ROAS" value={`${perf?.roas ?? 0}x`} />
        <MetricCard label="Frequência" value={String(perf?.frequency ?? 0)} />
        <MetricCard
          label="Gasto diário"
          value={formatIntegrationCents(perf?.dailySpendCents ?? 0)}
        />
        <MetricCard label="Conversões" value={String(perf?.conversions ?? 0)} />
      </div>

      {revenueCross && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Revenue Center · Meta + Kiwify
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Investimento"
              value={formatIntegrationCents(revenueCross.investimentoCents)}
            />
            <MetricCard
              label="Receita"
              value={formatIntegrationCents(revenueCross.receitaCents)}
            />
            <MetricCard label="Lucro" value={formatIntegrationCents(revenueCross.lucroCents)} />
            <MetricCard label="ROI" value={`${revenueCross.roiPct}%`} />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>Sincronização</PanelTitle>
          {connected && (
            <div className="flex flex-wrap gap-2">
              <ActionButton disabled={busy} onClick={() => void handleSync()}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Importar dados
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => void handleAnalyze()}>
                <Sparkles className="size-3" /> Analisar performance
              </ActionButton>
            </div>
          )}
        </PanelHeader>
        <PanelContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="h-3 w-3" />
              Última sincronização
            </p>
            <p className="text-xs text-zinc-200">
              {formatIntegrationDateTime(metrics?.lastSyncAt ?? null)}
            </p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="h-3 w-3" />
              Próxima sincronização
            </p>
            <p className="text-xs text-zinc-200">
              {formatIntegrationDateTime(metrics?.nextSyncAt ?? null)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-zinc-500">Intervalo automático</p>
            <p className="text-xs text-zinc-200">A cada {syncIntervalHours} horas</p>
          </div>
          {connection?.last_error && (
            <div className="sm:col-span-3">
              <p className="mb-1 flex items-center gap-1 text-[10px] text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                Último erro
              </p>
              <p className="text-xs text-rose-300">{connection.last_error}</p>
            </div>
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Campanhas" value={String(metrics?.campaignsCount ?? 0)} />
        <MetricCard label="Conjuntos" value={String(metrics?.adSetsCount ?? 0)} />
        <MetricCard label="Anúncios" value={String(metrics?.adsCount ?? 0)} />
        <MetricCard label="Pixels" value={String(metrics?.pixelsCount ?? 0)} />
        <MetricCard label="Públicos" value={String(metrics?.audiencesCount ?? 0)} />
      </div>

      {insights.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Performance AI</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {insights.map((insight) => (
              <div
                key={`${insight.type}-${insight.title}`}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px]"
              >
                <p className="font-medium text-zinc-200">{insight.title}</p>
                <p className="text-zinc-400">{insight.summary}</p>
                <p className="mt-1 text-sky-300/90">{insight.recommendation}</p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      {recommendations.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Autopilot · Ações pendentes de aprovação</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div
                key={`${rec.actionType}-${idx}`}
                className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-2 text-[11px]"
              >
                <p className="font-medium text-amber-200">
                  {ACTION_LABELS[rec.actionType] ?? rec.actionType}
                </p>
                <p className="text-zinc-300">{rec.title}</p>
                <p className="text-zinc-500">{rec.summary}</p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  Requer aprovação — não será executado automaticamente.
                </p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Shield className="size-3.5 text-sky-400" />
            Conexão Meta Business
          </PanelTitle>
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
              <ActionButton variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                <Unplug className="size-3" /> Desconectar
              </ActionButton>
              {metrics?.accountLabel && (
                <span className="self-center text-[11px] text-zinc-400">
                  Conta: <span className="text-zinc-200">{metrics.accountLabel}</span>
                </span>
              )}
            </div>
          )}
          <p className="text-[10px] text-zinc-500">
            Dados alimentam Aura CEO, Performance AI, Revenue Center e Autopilot.
          </p>
          <ul className="space-y-1 text-[10px] text-zinc-500">
            {INTEGRATION_SECURITY_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Campanhas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Conecte e importe para listar campanhas.</p>
          ) : (
            campaigns.map((campaign) => {
              const campaignMetrics = metricsMap[campaign.id];
              return (
                <div
                  key={campaign.id}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <p className="text-[12px] font-medium text-zinc-200">{campaign.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {META_STATUS_LABELS[campaign.status] ?? campaign.status}
                    {campaign.objective ? ` · ${campaign.objective}` : ""}
                  </p>
                  {campaignMetrics && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-zinc-400 sm:grid-cols-6">
                      <span>CTR {campaignMetrics.ctr}%</span>
                      <span>ROAS {campaignMetrics.roas}x</span>
                      <span>
                        Gasto {formatIntegrationCents(campaignMetrics.spend_cents, campaign.currency)}
                      </span>
                      <span>Conv. {campaignMetrics.conversions}</span>
                      <span>Freq. {campaignMetrics.frequency}</span>
                      <span>Orç. {campaignMetrics.budget_spent_pct}%</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Conjuntos</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={adSets}
              emptyLabel="Nenhum conjunto importado."
              renderItem={(adSet) => (
                <EntityRow
                  key={adSet.id}
                  title={adSet.name}
                  subtitle={[adSet.effectiveStatus, adSet.id].filter(Boolean).join(" · ")}
                />
              )}
            />
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Anúncios</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={ads}
              emptyLabel="Nenhum anúncio importado."
              renderItem={(ad) => (
                <EntityRow
                  key={ad.id}
                  title={ad.name}
                  subtitle={[ad.effectiveStatus, ad.id].filter(Boolean).join(" · ")}
                />
              )}
            />
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Pixels</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={pixels}
              emptyLabel="Nenhum Pixel importado."
              renderItem={(pixel) => (
                <EntityRow
                  key={pixel.id}
                  title={pixel.name}
                  subtitle={[
                    pixel.isUnavailable ? "indisponível" : "ativo",
                    pixel.lastFiredTime
                      ? `último disparo ${new Date(pixel.lastFiredTime).toLocaleDateString("pt-BR")}`
                      : "sem disparo recente",
                  ].join(" · ")}
                />
              )}
            />
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Públicos</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={audiences}
              emptyLabel="Nenhum público importado."
              renderItem={(audience) => (
                <EntityRow
                  key={audience.id}
                  title={audience.name}
                  subtitle={[
                    audience.subtype,
                    `~${audience.approximateCount.toLocaleString("pt-BR")} pessoas`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
            />
          </PanelContent>
        </Panel>
      </div>

      {connected && (
        <p className="text-[10px] text-zinc-600">
          Conexão básica em{" "}
          <Link href="/dashboard/platforms/meta" className="text-sky-400 hover:underline">
            Meta Connect
          </Link>
          {" · "}
          <Link href="/dashboard/integrations" className="text-violet-400 hover:underline">
            Integration Center
          </Link>
        </p>
      )}

      {businessManagers.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Business Managers</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={businessManagers}
              emptyLabel=""
              renderItem={(bm) => (
                <EntityRow key={bm.id} title={bm.name} subtitle={bm.id} />
              )}
            />
          </PanelContent>
        </Panel>
      )}

      {pages.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Páginas</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <EntityList
              items={pages}
              emptyLabel=""
              renderItem={(page) => (
                <EntityRow
                  key={page.id}
                  title={page.name}
                  subtitle={[page.category, page.id].filter(Boolean).join(" · ")}
                />
              )}
            />
          </PanelContent>
        </Panel>
      )}
    </div>
  );
}
