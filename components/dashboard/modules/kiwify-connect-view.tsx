"use client";

import { Loader2, Plug, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useKiwifyConnect } from "@/hooks/use-kiwify-connect";
import { formatIntegrationCents } from "@/utils/integrations";

export function KiwifyConnectView() {
  const {
    connection,
    products,
    sales,
    commissions,
    revenueTotalCents,
    commissionsTotalCents,
    topAffiliateProducts,
    loading,
    error,
    busy,
    connect,
    disconnect,
    sync,
    analyze,
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

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Kiwify Connect" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Status" value={connected ? "Conectada" : "Desconectada"} />
        <MetricCard label="Produtos" value={String(products.length)} />
        <MetricCard
          label="Receita (30d)"
          value={formatIntegrationCents(revenueTotalCents)}
        />
        <MetricCard
          label="Comissões"
          value={formatIntegrationCents(commissionsTotalCents)}
        />
      </div>

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
              <ActionButton
                disabled={busy}
                onClick={() => void sync().then((e) => e && toast.error(e))}
              >
                <RefreshCw className="size-3" /> Importar resultados
              </ActionButton>
              <ActionButton
                disabled={busy}
                onClick={() => void analyze().then((e) => e && toast.error(e))}
              >
                <Sparkles className="size-3" /> Analisar afiliação
              </ActionButton>
              <ActionButton variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                <Unplug className="size-3" /> Desconectar
              </ActionButton>
            </div>
          )}
          <p className="text-[10px] text-zinc-500">
            Resultados são enviados para Performance AI, Money Missions e Aura CEO via platform_results.
          </p>
        </PanelContent>
      </Panel>

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
