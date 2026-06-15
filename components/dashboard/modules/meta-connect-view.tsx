"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Eye,
  Loader2,
  Plug,
  RefreshCw,
  Shield,
  Unplug,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
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
import { META_READ_ONLY_MODE } from "@/utils/meta-intelligence";

type MetaConnectViewProps = {
  readOnly?: boolean;
};

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

export function MetaConnectView({ readOnly = META_READ_ONLY_MODE }: MetaConnectViewProps) {
  const searchParams = useSearchParams();
  const {
    connection,
    adAccounts,
    campaigns,
    metricsMap,
    businessManagers,
    pages,
    pixels,
    adSets,
    ads,
    metrics,
    activeCampaigns,
    pausedCampaigns,
    loading,
    error,
    busy,
    connectOAuth,
    disconnect,
    sync,
  } = useMetaConnect();

  const connected = connection?.status === "connected";
  const isReadOnly = readOnly || META_READ_ONLY_MODE;

  useEffect(() => {
    const meta = searchParams.get("meta");
    if (meta === "connected") {
      const businessManagersCount = Number(searchParams.get("businessManagers") ?? "0");
      const adAccountsCount = Number(searchParams.get("adAccounts") ?? "0");
      const pagesCount = Number(searchParams.get("pages") ?? "0");
      const pixelsCount = Number(searchParams.get("pixels") ?? "0");
      const hasImport =
        businessManagersCount > 0 ||
        adAccountsCount > 0 ||
        pagesCount > 0 ||
        pixelsCount > 0;
      if (hasImport) {
        toast.success(
          `Meta conectado. ${businessManagersCount} Business Manager(s), ${adAccountsCount} conta(s) de anúncio, ${pagesCount} página(s), ${pixelsCount} pixel(s) importados.`
        );
      } else {
        toast.success("Meta conectado.");
      }
    } else if (meta === "unconfigured") {
      toast.error("Meta Business não está configurado no servidor.");
    } else if (meta === "save_error") {
      toast.error("Não foi possível salvar a conexão Meta.");
    } else if (meta === "error" || meta === "denied") {
      toast.error("Não foi possível conectar à Meta.");
    }
  }, [searchParams]);

  async function handleSync() {
    const err = await sync();
    if (err) toast.error(err);
    else toast.success("Dados Meta sincronizados.");
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
      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200">
          <Eye className="size-3.5 shrink-0" />
          <span>
            <strong>Modo somente leitura</strong> — a Aura visualiza dados da Meta, mas não cria,
            edita ou publica anúncios.
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard label="Status" value={connected ? "Conectado" : "Desconectado"} />
        <MetricCard label="Business Managers" value={String(businessManagers.length)} />
        <MetricCard label="Contas de anúncio" value={String(adAccounts.length)} />
        <MetricCard label="Páginas" value={String(pages.length)} />
        <MetricCard label="Pixels" value={String(pixels.length)} />
        <MetricCard label="Campanhas" value={String(campaigns.length)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Campanhas ativas" value={String(activeCampaigns)} />
        <MetricCard label="Conjuntos" value={String(adSets.length)} />
        <MetricCard label="Anúncios" value={String(ads.length)} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Shield className="size-3.5 text-sky-400" />
            Conexão Meta Business
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          {!connected ? (
            <div className="space-y-2">
              <ActionButton disabled={busy} onClick={connectOAuth}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Plug className="size-3" />}
                Conectar Meta
              </ActionButton>
              <p className="text-[10px] text-zinc-500">
                Login seguro via Facebook — consentimento e credenciais criptografadas no servidor.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ActionButton disabled={busy} onClick={() => void handleSync()}>
                {busy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Sincronizar
              </ActionButton>
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
          <ul className="space-y-1 text-[10px] text-zinc-500">
            {INTEGRATION_SECURITY_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Business Managers</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <EntityList
            items={businessManagers}
            emptyLabel="Conecte e sincronize para listar Business Managers."
            renderItem={(bm) => (
              <EntityRow key={bm.id} title={bm.name} subtitle={bm.id} />
            )}
          />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Contas de anúncio</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <EntityList
            items={adAccounts}
            emptyLabel="Nenhuma conta de anúncio sincronizada."
            renderItem={(account) => (
              <EntityRow
                key={account.id}
                title={account.name}
                subtitle={`${account.currency} · ${account.external_account_id} · ${account.status}`}
              />
            )}
          />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Páginas</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <EntityList
            items={pages}
            emptyLabel="Nenhuma página encontrada."
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

      <Panel>
        <PanelHeader>
          <PanelTitle>Pixels</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <EntityList
            items={pixels}
            emptyLabel="Nenhum Pixel encontrado."
            renderItem={(pixel) => (
              <EntityRow
                key={pixel.id}
                title={pixel.name}
                subtitle={[
                  pixel.isUnavailable ? "indisponível" : "ativo",
                  pixel.lastFiredTime
                    ? `último disparo ${new Date(pixel.lastFiredTime).toLocaleDateString("pt-BR")}`
                    : "sem disparo recente",
                  pixel.id,
                ].join(" · ")}
              />
            )}
          />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Campanhas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              Conecte e sincronize para listar campanhas.
            </p>
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
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-zinc-400 sm:grid-cols-5">
                      <span>CTR {campaignMetrics.ctr}%</span>
                      <span>
                        CPA{" "}
                        {formatIntegrationCents(
                          Math.round(campaignMetrics.cpa * 100),
                          campaign.currency
                        )}
                      </span>
                      <span>ROAS {campaignMetrics.roas}x</span>
                      <span>
                        Gasto {formatIntegrationCents(campaignMetrics.spend_cents, campaign.currency)}
                      </span>
                      <span>Orç. {campaignMetrics.budget_spent_pct}%</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Conjuntos de anúncios</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <EntityList
            items={adSets}
            emptyLabel="Nenhum conjunto encontrado."
            renderItem={(adSet) => (
              <EntityRow
                key={adSet.id}
                title={adSet.name}
                subtitle={[
                  adSet.effectiveStatus,
                  adSet.campaignId ? `campanha ${adSet.campaignId}` : null,
                  adSet.id,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
            emptyLabel="Nenhum anúncio encontrado."
            renderItem={(ad) => (
              <EntityRow
                key={ad.id}
                title={ad.name}
                subtitle={[
                  ad.effectiveStatus,
                  ad.adSetId ? `conjunto ${ad.adSetId}` : null,
                  ad.id,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          />
        </PanelContent>
      </Panel>

      {connected && (
        <p className="text-[10px] text-zinc-600">
          Integração também disponível em{" "}
          <Link href="/dashboard/integrations" className="text-violet-400 hover:underline">
            Integration Center
          </Link>
          .
        </p>
      )}
    </div>
  );
}
