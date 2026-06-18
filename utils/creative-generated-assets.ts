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
    if (asset.status === "ready") ready += 1;
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
