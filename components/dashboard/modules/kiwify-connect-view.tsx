"use client";

import { AlertTriangle, Clock, Loader2, Plug, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useKiwifyConnect } from "@/hooks/use-kiwify-connect";
import { formatIntegrationCents, formatIntegrationDateTime } from "@/utils/integrations";

export function KiwifyConnectView() {
  const {
    connection,
    products,
    sales,
    commissions,
    metrics,
    insights,
    topAffiliateProducts,
    loading,
    error,
    busy,
    syncIntervalHours,
    connect,
    disconnect,
    sync,
    analyze,
    refresh,
  } = useKiwifyConnect();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accountId, setAccountId] = useState("");

  const connected = connection?.status === "connected";

  async function handleConnect() {
    const err = await connect({ clientId, clientSecret, accountId });
    if (err) toast.error(err);
    else toast.success("Kiwify conectada.");
  }

  async function handleSyncNow() {
    const err = await sync();
    if (err) toast.error(err);
    else {
      toast.success("Sincronização concluída.");
      await refresh();
    }
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
    return <EmptyState title="Kiwify Intelligence" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Receita total"
          value={formatIntegrationCents(metrics?.revenueTotalCents ?? 0)}
        />
        <MetricCard
          label="Receita do mês"
          value={formatIntegrationCents(metrics?.revenueMonthCents ?? 0)}
        />
        <MetricCard
          label="Vendas do dia"
          value={String(metrics?.salesTodayCount ?? 0)}
          hint={formatIntegrationCents(metrics?.salesTodayCents ?? 0)}
        />
        <MetricCard label="Produtos ativos" value={String(metrics?.activeProducts ?? 0)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ticket médio"
          value={formatIntegrationCents(metrics?.averageTicketCents ?? 0)}
        />
        <MetricCard
          label="Conversão"
          value={`${metrics?.conversionPct ?? 0}%`}
        />
        <MetricCard
          label="Comissões"
          value={formatIntegrationCents(metrics?.commissionsCents ?? 0)}
        />
        <MetricCard
          label="ROI estimado"
          value={`${metrics?.estimatedRoiPct ?? 0}%`}
          hint="Receita vs comissões (mês)"
        />
      </div>

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>Sincronização</PanelTitle>
          {connected && (
            <ActionButton disabled={busy} onClick={() => void handleSyncNow()}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Sincronizar agora
            </ActionButton>
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

      <Panel>
        <PanelHeader>
          <PanelTitle>Conexão Kiwify</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          {!connected ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200"
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200"
              />
              <input
                placeholder="Account ID (x-kiwify-account-id)"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200"
              />
              <ActionButton disabled={busy} onClick={() => void handleConnect()}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Plug className="size-3" />}
                Conectar API Key
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ActionButton disabled={busy} onClick={() => void handleAnalyze()}>
                <Sparkles className="size-3" /> Analisar performance
              </ActionButton>
              <ActionButton variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                <Unplug className="size-3" /> Desconectar
              </ActionButton>
            </div>
          )}
          <p className="text-[10px] text-zinc-500">
            Dados alimentam Aura CEO, Money Missions, Performance AI e Creator.
          </p>
        </PanelContent>
      </Panel>

      {(metrics?.topSellingProducts.length ?? 0) > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Produtos mais vendidos</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {metrics!.topSellingProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
              >
                {product.name} · {product.salesCount} venda(s) ·{" "}
                {formatIntegrationCents(product.revenueCents)}
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      {insights.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Recomendações (Performance AI)</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {insights.map((insight) => (
              <div
                key={`${insight.type}-${insight.title}`}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px]"
              >
                <p className="font-medium text-zinc-200">{insight.title}</p>
                <p className="text-zinc-400">{insight.summary}</p>
                <p className="mt-1 text-violet-300/90">{insight.recommendation}</p>
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      {topAffiliateProducts.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Melhores produtos para afiliação</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {topAffiliateProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
              >
                {product.name} · score {product.affiliate_score ?? 0}
                {product.price_cents != null
                  ? ` · ${formatIntegrationCents(product.price_cents)}`
                  : ""}
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Produtos</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {products.slice(0, 15).map((product) => (
            <div
              key={product.id}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
            >
              {product.name} · {product.status}
              {product.affiliate_enabled ? " · afiliado" : ""}
            </div>
          ))}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Vendas recentes</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {sales.slice(0, 10).map((sale) => (
            <div
              key={sale.id}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
            >
              {sale.product_name ?? "Venda"} · {formatIntegrationCents(sale.net_cents)} · {sale.status}
            </div>
          ))}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Comissões</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {commissions.slice(0, 10).map((commission) => (
            <div
              key={commission.id}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11px] text-zinc-300"
            >
              {commission.product_name ?? "Comissão"} ·{" "}
              {formatIntegrationCents(commission.amount_cents)} · {commission.status}
            </div>
          ))}
        </PanelContent>
      </Panel>
    </div>
  );
}
