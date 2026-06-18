"use client";

import { useState } from "react";
import {
  Download,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreativeDirector } from "@/hooks/use-creative-director";
import type { CreativeGeneratedAssetType, CreativeMediaProviderId } from "@/types/database";
import {
  buildCreativeGeneratedDownloadUrl,
  buildCreativeGeneratedPreviewUrl,
  CREATIVE_DIRECTOR_REAL_SAFE_MODE,
  getCreativeGeneratedAssetTypeLabel,
  getCreativeGeneratedStatusLabel,
} from "@/utils/creative-generated-assets";
import { cn } from "@/utils/cn";

const GENERATE_TYPES: CreativeGeneratedAssetType[] = [
  "image",
  "story",
  "thumbnail",
  "carousel",
  "reel_cover",
  "ugc_frame",
];

function AssetRow({ asset }: { asset: import("@/types/database").CreativeGeneratedAsset }) {
  const excellence = (asset.metadata as Record<string, unknown> | null)?.prompt_excellence as
    | { score?: number; approved?: boolean }
    | undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-white/[0.06] p-3 sm:flex-row sm:items-start">
      <div className="shrink-0">
        {asset.status === "delivered" && asset.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnail_url ?? buildCreativeGeneratedPreviewUrl(asset.id)}
            alt={getCreativeGeneratedAssetTypeLabel(asset.asset_type)}
            className="size-24 rounded-md border border-white/[0.08] object-cover"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
            <ImageIcon className="size-6 text-zinc-600" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-zinc-100">
            {getCreativeGeneratedAssetTypeLabel(asset.asset_type)}
          </span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
            {asset.provider}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium",
              asset.status === "delivered"
                ? "text-emerald-400"
                : asset.status === "blocked"
                  ? "text-red-400"
                  : asset.status === "failed"
                    ? "text-red-400"
                    : "text-amber-400"
            )}
          >
            {getCreativeGeneratedStatusLabel(asset.status)}
          </span>
        </div>

        {asset.prompt ? (
          <p className="line-clamp-2 text-[11px] text-zinc-500">{asset.prompt}</p>
        ) : null}

        {excellence?.score != null ? (
          <p className="text-[10px] text-zinc-400">
            Excellence prompt: {excellence.score}/100
            {excellence.approved ? " · aprovado" : " · bloqueado"}
          </p>
        ) : null}
      </div>

      {asset.status === "delivered" ? (
        <div className="flex shrink-0 gap-2">
          <a
            href={buildCreativeGeneratedPreviewUrl(asset.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-2.5 text-[11px] text-zinc-300 hover:bg-white/[0.04]"
          >
            Preview
          </a>
          <a
            href={buildCreativeGeneratedDownloadUrl(asset.id)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/15"
          >
            <Download className="size-3" />
            Download
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function CreativeDirectorView() {
  const { dashboard, assets, storageReady, loading, error, busy, refresh, generateRealAsset } =
    useCreativeDirector();
  const [provider, setProvider] = useState<CreativeMediaProviderId>("openai");

  async function handleGenerate(assetType: CreativeGeneratedAssetType) {
    const { message, ok } = await generateRealAsset({ asset_type: assetType, provider });
    if (ok) {
      toast.success(message ?? "Asset real gerado.");
    } else {
      toast.error(message ?? "Falha na geração.");
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

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      ) : null}

      {!storageReady ? (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          Bucket product-files não configurado — configure o Storage antes de gerar assets reais.
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Assets reais" value={String(dashboard?.total ?? 0)} hint="Total gerado" />
        <MetricCard label="Prontos" value={String(dashboard?.ready ?? 0)} hint="PNG/JPG no Storage" />
        <MetricCard
          label="Bloqueados"
          value={String(dashboard?.blocked ?? 0)}
          hint="Excellence reprovou prompt"
        />
        <MetricCard label="Falhas" value={String(dashboard?.failed ?? 0)} hint="Erro na geração" />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-fuchsia-400" />
            Gerar asset real
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <p className="text-[11px] text-zinc-400">
            Fluxo: prompt otimizado → Excellence review → OpenAI Images / Flux → Storage → preview →
            download.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-500">Provider:</span>
            {(["openai", "flux"] as CreativeMediaProviderId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setProvider(id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors",
                  provider === id
                    ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200"
                    : "border-white/[0.08] text-zinc-400 hover:bg-white/[0.04]"
                )}
              >
                {id}
              </button>
            ))}
            <span className="text-[10px] text-zinc-600">Runway · Kling · Veo — estrutura preparada</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {GENERATE_TYPES.map((type) => (
              <ActionButton
                key={type}
                disabled={busy || !storageReady}
                onClick={() => void handleGenerate(type)}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                {getCreativeGeneratedAssetTypeLabel(type)}
              </ActionButton>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            <p className="text-[10px] text-zinc-500">{CREATIVE_DIRECTOR_REAL_SAFE_MODE.message}</p>
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader className="flex flex-row items-center justify-between gap-2">
          <PanelTitle>Assets Reais</PanelTitle>
          <ActionButton variant="ghost" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className={cn("size-3", busy && "animate-spin")} />
            Atualizar
          </ActionButton>
        </PanelHeader>
        <PanelContent>
          {assets.length === 0 ? (
            <EmptyState
              title="Nenhum asset real ainda"
              description="Gere imagens via OpenAI Images ou Flux. Tipos suportados: image, carousel, story, thumbnail, reel_cover, ugc_frame."
            />
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Providers</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(dashboard?.providers ?? []).map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-white/[0.06] px-3 py-2 text-[11px] text-zinc-400"
              >
                <p className="font-medium text-zinc-200">{p.label}</p>
                <p className="mt-1 text-[10px]">{p.description}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {p.supportsImage ? "Imagem" : ""}
                  {p.supportsImage && p.supportsVideo ? " · " : ""}
                  {p.supportsVideo ? "Vídeo" : ""}
                  {!p.available ? " · em breve" : ""}
                </p>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
