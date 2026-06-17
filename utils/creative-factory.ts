import type { CreativeAsset, CreativeAssetStatus, CreativeAssetType } from "@/types/database";
import { hasCreativeDirectorPackage } from "@/utils/creative-director";

export const CREATIVE_FILES_BUCKET = "product-files";

export const CREATIVE_ASSET_TYPES: CreativeAssetType[] = [
  "image",
  "carousel",
  "banner",
  "thumbnail",
  "vsl_script",
  "reel_script",
  "ugc_script",
  "headline_variations",
  "cta_variations",
];

export const CREATIVE_FACTORY_SAFE_MODE = {
  active: true,
  message:
    "Creative Factory gera arquivos e vincula à operação — não publica anúncios nem sobe campanhas automaticamente.",
};

export type CreativeMediaProvider = "text-only" | "openai" | "runway" | "kling" | "veo";

export type CreativeGeneratorProvider = {
  id: CreativeMediaProvider;
  label: string;
  supportsImage: boolean;
  supportsVideo: boolean;
  available: boolean;
};

/** Providers preparados para integração futura (V1 usa text-only). */
export const CREATIVE_GENERATOR_PROVIDERS: CreativeGeneratorProvider[] = [
  { id: "text-only", label: "Aura Text Factory", supportsImage: false, supportsVideo: false, available: true },
  { id: "openai", label: "OpenAI Images", supportsImage: true, supportsVideo: false, available: false },
  { id: "runway", label: "Runway", supportsImage: false, supportsVideo: true, available: false },
  { id: "kling", label: "Kling", supportsImage: false, supportsVideo: true, available: false },
  { id: "veo", label: "Veo", supportsImage: false, supportsVideo: true, available: false },
];

export type CreativeFactoryIntake = {
  asset_type: CreativeAssetType;
  operation_id?: string | null;
  product_id?: string | null;
  titulo?: string;
  promessa?: string;
  avatar?: string;
  problema?: string;
  solucao?: string;
  headline?: string;
  provider?: CreativeMediaProvider;
};

export type GeneratedCreativeImage = {
  title: string;
  prompt: string;
  copy: string;
  format: string;
  visual_brief: string;
  cta: string;
  dimensions: string;
};

export type GeneratedCreativeCarousel = {
  title: string;
  prompt: string;
  copy: string;
  format: string;
  slides: { headline: string; body: string; visual_note: string }[];
};

export type GeneratedCreativeVsl = {
  title: string;
  prompt: string;
  copy: string;
  format: string;
  hook: string;
  problem: string;
  agitation: string;
  solution: string;
  proof: string;
  offer: string;
  cta: string;
  full_script: string;
};

export type GeneratedCreativeUgc = {
  title: string;
  prompt: string;
  copy: string;
  format: string;
  hook: string;
  talking_points: string[];
  b_roll: string[];
  cta: string;
  full_script: string;
};

export type GeneratedCreativeBanner = GeneratedCreativeImage;

export type GeneratedCreativeThumbnail = GeneratedCreativeImage;

export type GeneratedCreativeReel = {
  title: string;
  prompt: string;
  copy: string;
  format: string;
  hook: string;
  scenes: { duration_sec: number; visual: string; audio: string }[];
  cta: string;
  full_script: string;
};

export type CreativeFactoryDashboardMetrics = {
  total: number;
  ready: number;
  byType: Partial<Record<CreativeAssetType, number>>;
  operationLinked: number;
};

export function buildCreativeStoragePath(
  userId: string,
  operationId: string | null,
  assetId: string,
  extension: "json" | "txt"
): string {
  const opSegment = operationId ?? "standalone";
  return `creative-assets/${userId}/${opSegment}/${assetId}.${extension}`;
}

export function buildCreativeFactoryDownloadUrl(assetId: string): string {
  return `/api/creative-factory/download/${assetId}`;
}

export function resolveCreativeOutputFormat(assetType: CreativeAssetType): "json" | "txt" {
  if (assetType === "vsl_script" || assetType === "ugc_script" || assetType === "reel_script") {
    return "txt";
  }
  return "json";
}

export function getCreativeAssetTypeLabel(type: CreativeAssetType): string {
  const labels: Record<CreativeAssetType, string> = {
    image: "Imagem",
    carousel: "Carrossel",
    banner: "Banner",
    thumbnail: "Thumbnail",
    vsl_script: "Roteiro VSL",
    reel_script: "Roteiro Reels",
    ugc_script: "Roteiro UGC",
    headline_variations: "Variações de Headline",
    cta_variations: "Variações de CTA",
  };
  return labels[type];
}

export function computeCreativeFactoryDashboard(
  assets: CreativeAsset[]
): CreativeFactoryDashboardMetrics {
  const byType: Partial<Record<CreativeAssetType, number>> = {};
  let ready = 0;
  let operationLinked = 0;

  for (const asset of assets) {
    byType[asset.asset_type] = (byType[asset.asset_type] ?? 0) + 1;
    if (asset.status === "ready") ready += 1;
    if (asset.operation_id) operationLinked += 1;
  }

  return {
    total: assets.length,
    ready,
    byType,
    operationLinked,
  };
}

export type CreativeFactoryMetadata = {
  latest_asset_id?: string;
  asset_ids?: string[];
};

export function readCreativeFactoryMetadata(
  metadata: unknown
): CreativeFactoryMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const root = metadata as Record<string, unknown>;
  const cf = root.creative_factory;
  if (!cf || typeof cf !== "object" || Array.isArray(cf)) return null;
  const factory = cf as Record<string, unknown>;
  const latest =
    typeof factory.latest_asset_id === "string" ? factory.latest_asset_id : undefined;
  const assetIds = Array.isArray(factory.asset_ids)
    ? factory.asset_ids.filter((id): id is string => typeof id === "string")
    : undefined;
  if (!latest && !assetIds?.length) return null;
  return { latest_asset_id: latest, asset_ids: assetIds };
}

export function mergeCreativeFactoryMetadata(
  metadata: unknown,
  assetId: string
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const existing = readCreativeFactoryMetadata(base) ?? {};
  const assetIds = [...new Set([...(existing.asset_ids ?? []), assetId])];
  return {
    ...base,
    creative_factory: {
      latest_asset_id: assetId,
      asset_ids: assetIds,
    },
  };
}

export function hasOperationCreativeAssets(params: {
  assets_id: string | null;
  metadata: unknown;
  hasCreativeFactoryAssets?: boolean;
}): boolean {
  if (params.assets_id) return true;
  if (params.hasCreativeFactoryAssets) return true;
  if (hasCreativeDirectorPackage(params.metadata)) return true;
  return Boolean(readCreativeFactoryMetadata(params.metadata)?.latest_asset_id);
}

export function getCreativeAssetStatusLabel(status: CreativeAssetStatus): string {
  const labels: Record<CreativeAssetStatus, string> = {
    generating: "Gerando",
    ready: "Pronto",
    failed: "Falhou",
  };
  return labels[status];
}
