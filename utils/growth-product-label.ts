export type GrowthProductLabelInput = {
  operationId?: string | null;
  productId?: string | null;
  copyId?: string | null;
  creativeId?: string | null;
  landingId?: string | null;
  campaignId?: string | null;
  niche?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ResolvedGrowthProductLabel = {
  productLabel: string | null;
  productId: string | null;
  operationId: string | null;
  niche: string | null;
};

const METADATA_LABEL_KEYS = [
  "product_label",
  "product_name",
  "campaign_label",
  "copy_label",
  "landing_label",
  "creative_label",
  "produto",
] as const;

function readMetaString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractProductLabelFromMetadata(
  metadata?: Record<string, unknown> | null
): Partial<ResolvedGrowthProductLabel> {
  if (!metadata) return {};

  let productLabel: string | null = null;
  for (const key of METADATA_LABEL_KEYS) {
    const value = readMetaString(metadata, key);
    if (value) {
      productLabel = value;
      break;
    }
  }

  const niche = readMetaString(metadata, "niche");
  const productId =
    readMetaString(metadata, "product_id") ??
    (typeof metadata.productId === "string" ? metadata.productId : null);
  const operationId =
    readMetaString(metadata, "operation_id") ??
    (typeof metadata.operationId === "string" ? metadata.operationId : null);

  return {
    productLabel,
    productId,
    operationId,
    niche,
  };
}

export function mergeGrowthProductMetadata(
  input: GrowthProductLabelInput,
  resolved: ResolvedGrowthProductLabel
): GrowthProductLabelInput & { metadata: Record<string, unknown> } {
  const baseMeta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {};

  const metadata: Record<string, unknown> = {
    ...baseMeta,
    ...(resolved.productLabel ? { product_label: resolved.productLabel } : {}),
    ...(resolved.productId ? { product_id: resolved.productId } : {}),
    ...(resolved.operationId ? { operation_id: resolved.operationId } : {}),
    ...(resolved.niche ? { niche: resolved.niche } : {}),
  };

  return {
    ...input,
    productId: input.productId ?? resolved.productId,
    operationId: input.operationId ?? resolved.operationId,
    niche: input.niche ?? resolved.niche,
    metadata,
  };
}
