import { CreatorAdsCampaignsRepository } from "@/lib/supabase/repositories/creator-ads.repository";
import { CreatorCopylabRepository } from "@/lib/supabase/repositories/copylab.repository";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import {
  extractProductLabelFromMetadata,
  mergeGrowthProductMetadata,
  type GrowthProductLabelInput,
  type ResolvedGrowthProductLabel,
} from "@/utils/growth-product-label";
import { resolveOperationProductName } from "@/utils/operation-product";
import { getOptionalDataContext } from "./context";

function pickLabel(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export async function resolveGrowthProductLabel(
  input: GrowthProductLabelInput
): Promise<ResolvedGrowthProductLabel> {
  const fromMeta = extractProductLabelFromMetadata(input.metadata);
  let productLabel = fromMeta.productLabel ?? null;
  let productId = input.productId ?? fromMeta.productId ?? null;
  let operationId = input.operationId ?? fromMeta.operationId ?? null;
  let niche = input.niche ?? fromMeta.niche ?? null;

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { productLabel, productId, operationId, niche };
  }

  if (input.operationId) {
    const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
    const { data: operation } = await opRepo.findById(input.operationId);
    if (operation) {
      const meta =
        operation.metadata && typeof operation.metadata === "object" && !Array.isArray(operation.metadata)
          ? (operation.metadata as Record<string, unknown>)
          : undefined;
      productLabel = pickLabel(
        productLabel,
        operation.product_nome,
        resolveOperationProductName(operation, meta)
      );
      productId = productId ?? operation.product_id;
      operationId = operationId ?? operation.id;
    }
  }

  if (!productLabel && input.productId) {
    const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
    const { data: product } = await productsRepo.findById(input.productId);
    if (product) {
      productLabel = pickLabel(productLabel, product.nome, product.nicho);
      niche = niche ?? product.nicho ?? null;
      productId = productId ?? product.id;
    }
  }

  if (!productLabel && input.copyId) {
    const copyRepo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
    const { data: copy } = await copyRepo.findById(input.copyId);
    if (copy) {
      productLabel = pickLabel(productLabel, copy.nome, copy.headline);
      productId = productId ?? copy.product_id;
    }
  }

  if (!productLabel && input.landingId) {
    const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);
    const { data: landing } = await landingRepo.findById(input.landingId);
    if (landing) {
      productLabel = pickLabel(productLabel, landing.title, landing.headline);
      productId = productId ?? landing.product_id;
      operationId = operationId ?? landing.operation_id;
    }
  }

  if (!productLabel && input.creativeId) {
    const creativeRepo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
    const { data: creative } = await creativeRepo.findById(input.creativeId);
    if (creative) {
      productLabel = pickLabel(productLabel, creative.title, creative.copy);
      operationId = operationId ?? creative.operation_id;
    }
  }

  if (!productLabel && input.campaignId) {
    const campaignRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
    const { data: campaign } = await campaignRepo.findById(input.campaignId);
    if (campaign) {
      productLabel = pickLabel(productLabel, campaign.nome, campaign.promessa);
      productId = productId ?? campaign.product_id;
    }
  }

  return { productLabel, productId, operationId, niche };
}

export async function enrichGrowthProductLabelInput(
  input: GrowthProductLabelInput
): Promise<GrowthProductLabelInput & { metadata: Record<string, unknown> }> {
  const resolved = await resolveGrowthProductLabel(input);
  return mergeGrowthProductMetadata(input, resolved);
}
