import type { Json } from "@/types/database";
import {
  ADS_COMMANDER_SAFE_MODE,
  isAdsPublishEnabled,
  requiresExplicitPublishApproval,
} from "@/utils/ads-commander";

export const META_UPLOAD_SAFE_MODE = ADS_COMMANDER_SAFE_MODE;

export function isMetaCreativeUploadEnabled(): boolean {
  return isAdsPublishEnabled();
}

export function requiresExplicitMetaUploadApproval(): boolean {
  return requiresExplicitPublishApproval();
}

export function readGeneratedAssetId(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const generatedAssetId = (metadata as Record<string, unknown>).generated_asset_id;
  return typeof generatedAssetId === "string" && generatedAssetId.trim()
    ? generatedAssetId.trim()
    : null;
}

export function mergeMetaUploadMetadata(
  metadata: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}
