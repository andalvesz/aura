import type {
  CreativeGeneratedAsset,
  CreativeGeneratedAssetStatus,
  CreativeGeneratedAssetType,
  CreativeMediaProviderId,
} from "@/types/database";
import {
  CREATIVE_GENERATED_ASSET_LABELS,
  CREATIVE_GENERATED_STATUS_LABELS,
  CREATIVE_MEDIA_PROVIDERS,
} from "@/utils/creative-media-providers";

export const CREATIVE_DIRECTOR_REAL_SAFE_MODE = {
  active: true,
  message:
    "Creative Director Real gera imagens reais e salva no Storage — não publica anúncios automaticamente.",
};

export type CreativeGeneratedAssetIntake = {
  asset_type: CreativeGeneratedAssetType;
  creative_id?: string | null;
  provider?: CreativeMediaProviderId;
  prompt?: string;
  copy?: string;
  title?: string;
  operation_id?: string | null;
};

export type CreativeDirectorRealDashboard = {
  total: number;
  ready: number;
  blocked: number;
  failed: number;
  byType: Partial<Record<CreativeGeneratedAssetType, number>>;
  byProvider: Partial<Record<CreativeMediaProviderId, number>>;
  providers: typeof CREATIVE_MEDIA_PROVIDERS;
  safeMode: typeof CREATIVE_DIRECTOR_REAL_SAFE_MODE;
};

export function buildCreativeGeneratedStoragePath(
  userId: string,
  assetId: string,
  extension: "png" | "webp" | "jpg" = "png"
): string {
  return `creative-generated/${userId}/${assetId}.${extension}`;
}

export function buildCreativeGeneratedPreviewUrl(assetId: string): string {
  return `/api/creative-director/assets/${assetId}/preview`;
}

export function buildCreativeGeneratedDownloadUrl(assetId: string): string {
  return `/api/creative-director/assets/${assetId}/download`;
}

export function getCreativeGeneratedAssetTypeLabel(type: CreativeGeneratedAssetType): string {
  return CREATIVE_GENERATED_ASSET_LABELS[type];
}

export function getCreativeGeneratedStatusLabel(status: CreativeGeneratedAssetStatus): string {
  return CREATIVE_GENERATED_STATUS_LABELS[status];
}

export function isCreativeGeneratedAssetDelivered(status: CreativeGeneratedAssetStatus): boolean {
  return status === "delivered";
}

export function computeCreativeDirectorRealDashboard(
  assets: CreativeGeneratedAsset[]
): CreativeDirectorRealDashboard {
  const byType: Partial<Record<CreativeGeneratedAssetType, number>> = {};
  const byProvider: Partial<Record<CreativeMediaProviderId, number>> = {};
  let ready = 0;
  let blocked = 0;
  let failed = 0;

  for (const asset of assets) {
    byType[asset.asset_type] = (byType[asset.asset_type] ?? 0) + 1;
    byProvider[asset.provider] = (byProvider[asset.provider] ?? 0) + 1;
    if (isCreativeGeneratedAssetDelivered(asset.status)) ready += 1;
    if (asset.status === "blocked") blocked += 1;
    if (asset.status === "failed") failed += 1;
  }

  return {
    total: assets.length,
    ready,
    blocked,
    failed,
    byType,
    byProvider,
    providers: CREATIVE_MEDIA_PROVIDERS,
    safeMode: CREATIVE_DIRECTOR_REAL_SAFE_MODE,
  };
}

export type CreativeGeneratedAssetSummary = {
  id: string;
  asset_type: CreativeGeneratedAssetType;
  status: CreativeGeneratedAssetStatus;
  thumbnail_url: string | null;
  preview_url: string;
  download_url: string;
  title: string | null;
  excellence_score: number | null;
};

export function toCreativeGeneratedAssetSummary(
  asset: CreativeGeneratedAsset
): CreativeGeneratedAssetSummary {
  const meta = asset.metadata as Record<string, unknown> | null;
  const excellence = readPromptExcellenceFromMetadata(meta);
  return {
    id: asset.id,
    asset_type: asset.asset_type,
    status: asset.status,
    thumbnail_url: asset.thumbnail_url,
    preview_url: buildCreativeGeneratedPreviewUrl(asset.id),
    download_url: buildCreativeGeneratedDownloadUrl(asset.id),
    title: typeof meta?.title === "string" ? meta.title : null,
    excellence_score: excellence.score,
  };
}
export function readPromptExcellenceFromMetadata(metadata: unknown): {
  score: number | null;
  approved: boolean;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { score: null, approved: false };
  }
  const root = metadata as Record<string, unknown>;
  const excellence = root.prompt_excellence;
  if (!excellence || typeof excellence !== "object" || Array.isArray(excellence)) {
    return { score: null, approved: false };
  }
  const row = excellence as Record<string, unknown>;
  const score = typeof row.score === "number" ? row.score : null;
  return { score, approved: row.approved === true };
}
