import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import type { MasterFlow, TableInsert } from "@/types/database";
import { intakeFromProductBundle } from "@/utils/copylab";
import { readMasterFlowMetadata, type MasterFlowMetadata } from "@/utils/master-flow";
import {
  applySalesStepFailure,
  buildSalesPackage,
  type SalesPackage,
  type SalesStepKey,
} from "@/utils/sales-system";
import { evaluateCheckoutCompletion, validateCheckoutUrl } from "@/utils/revenue-certification";
import { getOptionalDataContext } from "./context";

export type SalesSystemResult = {
  salesPackage: SalesPackage;
  metadataPatch: MasterFlowMetadata;
  funnelId: string | null;
  fatalError: string | null;
};

async function ensureFunnelId(
  flow: MasterFlow,
  meta: MasterFlowMetadata
): Promise<{ funnelId: string | null; error: string | null }> {
  if (flow.funnel_id) return { funnelId: flow.funnel_id, error: null };

  const ctx = await getOptionalDataContext();
  if (!ctx || !flow.product_id) {
    return { funnelId: null, error: "Produto não vinculado para criar funil." };
  }

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const { data: existing } = await funnelsRepo.findLatestByProductId(flow.product_id);
  if (existing) return { funnelId: existing.id, error: null };

  const { generateFunnel } = await import("./funnel-engine.service");
  const { bundle, error } = await generateFunnel({
    product_id: flow.product_id,
    copylab_id: meta.copylab_id ?? null,
    factory_id: meta.factory_id ?? null,
    funnel_name: meta.opportunity_name ?? undefined,
    niche: meta.niche ?? undefined,
    auto_generate_landing: false,
  });

  return { funnelId: bundle?.funnel.id ?? null, error: error ?? null };
}

async function ensureOperationId(
  flow: MasterFlow,
  meta: MasterFlowMetadata,
  productName: string
): Promise<{ operationId: string | null; error: string | null }> {
  if (meta.operation_id) return { operationId: meta.operation_id, error: null };

  const ctx = await getOptionalDataContext();
  if (!ctx) return { operationId: null, error: "Usuário não autenticado." };

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation, error } = await opRepo.create({
    status: "preparing",
    titulo: `Sales System — ${productName}`,
    product_id: flow.product_id,
    product_nome: productName,
    copylab_id: meta.copylab_id ?? null,
  } satisfies Omit<TableInsert<"operation_center">, "user_id">);

  if (error || !operation) {
    return { operationId: null, error: error ?? "Erro ao criar operação." };
  }

  return { operationId: operation.id, error: null };
}

export async function runSalesSystem(flow: MasterFlow): Promise<SalesSystemResult> {
  const meta = readMasterFlowMetadata(flow);
  const productName = meta.opportunity_name ?? "Negócio digital Aura";

  let workingMeta: MasterFlowMetadata = { ...meta };
  let funnelId = flow.funnel_id ?? null;
  const pendingItems: string[] = [...(meta.sales_pending_items ?? [])];

  let offerId = meta.offer_id ?? null;
  let landingId = meta.landing_id ?? null;
  let landingUrl = meta.landing_url ?? meta.funnel_url ?? null;
  let copylabId = meta.copylab_id ?? null;
  let creativeAssetId = meta.creative_asset_id ?? null;
  let operationId = meta.operation_id ?? null;
  let checkoutId = meta.checkout_id ?? null;
  let checkoutUrl = meta.checkout_url ?? null;
  let commercialScore = meta.commercial_score ?? meta.commercial_excellence_score ?? null;
  let excellenceScore = meta.commercial_excellence_score ?? null;

  let salesPackage = buildSalesPackage({
    meta: workingMeta,
    productId: flow.product_id,
    offerId,
    landingId,
    landingUrl,
    copylabId,
    creativeAssetId,
    checkoutId,
    checkoutUrl,
    commercialScore,
    pendingItems,
  });

  function recordFailure(step: SalesStepKey, message: string) {
    salesPackage = applySalesStepFailure(salesPackage, step, message);
  }

  if (!flow.product_id) {
    return {
      salesPackage: applySalesStepFailure(salesPackage, "offer_engine", "Produto não vinculado."),
      metadataPatch: { sales_pending_items: pendingItems },
      funnelId,
      fatalError: null,
    };
  }

  // 1 — Offer Engine
  try {
    const { generateOfferStack } = await import("./offer-engine.service");
    const { bundle: offerBundle, error } = await generateOfferStack({
      product_id: flow.product_id,
      funnel_id: funnelId,
      factory_id: meta.factory_id ?? null,
    });
    if (error) {
      recordFailure("offer_engine", error);
    } else {
      const frontOffer =
        offerBundle?.offers.find((offer) => offer.offer_type === "front_end") ??
        offerBundle?.offers[0] ??
        null;
      offerId = frontOffer?.id ?? offerId;
      workingMeta = { ...workingMeta, offer_id: offerId };
    }
  } catch (err) {
    recordFailure(
      "offer_engine",
      err instanceof Error ? err.message : "Falha ao gerar oferta."
    );
  }

  // 2 — Landing Factory (funnel + pages)
  try {
    const funnelResult = await ensureFunnelId(flow, workingMeta);
    if (funnelResult.error || !funnelResult.funnelId) {
      recordFailure("landing_factory", funnelResult.error ?? "Funil não criado.");
    } else {
      funnelId = funnelResult.funnelId;
      const { generateFunnelPages } = await import("./funnel-pages.service");
      const { bundle: pagesBundle, error } = await generateFunnelPages({
        funnel_id: funnelId,
      });
      if (error) {
        recordFailure("landing_factory", error);
      } else {
        landingId = pagesBundle?.pages?.[0]?.landing_page_id ?? landingId;
        workingMeta = { ...workingMeta, landing_id: landingId };
      }
    }
  } catch (err) {
    recordFailure(
      "landing_factory",
      err instanceof Error ? err.message : "Falha ao gerar landing."
    );
  }

  // 3 — CopyLab
  try {
    const { loadCreatorBundles } = await import("./creator.service");
    const { bundles } = await loadCreatorBundles();
    const bundle = bundles.find((b) => b.product.id === flow.product_id);
    if (!bundle) {
      recordFailure("copylab", "Bundle do produto não encontrado.");
    } else {
      const { generateCopylab } = await import("./copylab.service");
      const { record, error } = await generateCopylab(intakeFromProductBundle(bundle));
      if (error) {
        recordFailure("copylab", error);
      } else {
        copylabId = record?.id ?? copylabId;
        workingMeta = { ...workingMeta, copylab_id: copylabId };
      }
    }
  } catch (err) {
    recordFailure(
      "copylab",
      err instanceof Error ? err.message : "Falha ao gerar copy."
    );
  }

  // 4 — Creative Director
  try {
    const op = await ensureOperationId(
      { ...flow, funnel_id: funnelId },
      { ...workingMeta, copylab_id: copylabId },
      productName
    );
    if (op.error || !op.operationId) {
      recordFailure("creative_director", op.error ?? "Operação não criada.");
    } else {
      operationId = op.operationId;
      const { generateCreativePackage } = await import("./creative-director.service");
      const { generatedAssets, error } = await generateCreativePackage(operationId);
      if (error) {
        recordFailure("creative_director", error);
      } else {
        creativeAssetId = generatedAssets?.[0]?.id ?? creativeAssetId;
        workingMeta = {
          ...workingMeta,
          operation_id: operationId,
          creative_asset_id: creativeAssetId,
        };
      }
    }
  } catch (err) {
    recordFailure(
      "creative_director",
      err instanceof Error ? err.message : "Falha ao gerar criativos."
    );
  }

  // 5 — Checkout Engine
  try {
    const { createCheckout, syncCheckout, applyCheckoutToProduct, getCheckoutUrl } =
      await import("./checkout-engine.service");

    const { checkout, error: createError } = await createCheckout({
      productId: flow.product_id,
      productName: productName,
    });

    if (createError) {
      recordFailure("checkout_engine", createError);
    } else {
      checkoutId = checkout?.id ?? checkoutId;
      checkoutUrl = checkout?.checkout_url ?? null;

      if (checkout && !checkoutUrl) {
        const synced = await syncCheckout(checkout.id);
        checkoutUrl = synced.checkout?.checkout_url ?? null;
      }

      if (checkoutUrl && validateCheckoutUrl(checkoutUrl)) {
        await applyCheckoutToProduct(flow.product_id);
      } else {
        const resolved = await getCheckoutUrl(flow.product_id);
        checkoutUrl = resolved.checkoutUrl ?? checkoutUrl;
        if (checkoutUrl) {
          await applyCheckoutToProduct(flow.product_id);
        }
      }

      const completion = evaluateCheckoutCompletion({ checkoutUrl });
      workingMeta = {
        ...workingMeta,
        checkout_id: checkoutId,
        checkout_url: checkoutUrl,
        checkout_completion: completion,
        checkout_pending: !checkoutUrl || !validateCheckoutUrl(checkoutUrl),
        checkout_gap: completion.gaps.join("; ") || null,
      };

      if (!checkoutUrl || !validateCheckoutUrl(checkoutUrl)) {
        recordFailure(
          "checkout_engine",
          completion.gaps.join("; ") || "Checkout inválido ou ausente."
        );
      }
    }
  } catch (err) {
    recordFailure(
      "checkout_engine",
      err instanceof Error ? err.message : "Falha ao configurar checkout."
    );
  }

  // 6 — Commercial Excellence
  try {
    const { runCommercialExcellence } = await import("./commercial-excellence.service");
    const { score, error: excellenceError } = await runCommercialExcellence({
      copylabId: copylabId,
      funnelId,
      campaignId: flow.campaign_id,
      factoryId: meta.factory_id,
      productId: flow.product_id,
      landingId,
      creativeAssetId,
      offerId,
      label: productName,
    });

    if (excellenceError) {
      recordFailure("commercial_excellence", excellenceError);
    } else {
      excellenceScore = score;
      commercialScore = score;
      workingMeta = {
        ...workingMeta,
        excellence_score: score,
        commercial_excellence_score: score,
      };
    }
  } catch (err) {
    recordFailure(
      "commercial_excellence",
      err instanceof Error ? err.message : "Falha na excelência comercial."
    );
  }

  salesPackage = buildSalesPackage({
    meta: {
      ...workingMeta,
      factory_id: meta.factory_id,
      validation_approved: meta.validation_approved,
      selected_strategy: meta.selected_strategy,
      product_build_brief: meta.product_build_brief,
      product_quality_score: meta.product_quality_score,
      product_strategy_adherence: meta.product_strategy_adherence,
    },
    productId: flow.product_id,
    offerId,
    landingId,
    landingUrl,
    copylabId,
    creativeAssetId,
    checkoutId,
    checkoutUrl,
    commercialScore,
    pendingItems: salesPackage.pendingItems,
  });

  const metadataPatch: MasterFlowMetadata = {
    offer_id: offerId,
    landing_id: landingId,
    landing_url: landingUrl,
    copylab_id: copylabId,
    operation_id: operationId,
    creative_asset_id: creativeAssetId,
    checkout_id: checkoutId,
    checkout_url: checkoutUrl,
    excellence_score: excellenceScore,
    commercial_excellence_score: excellenceScore,
    commercial_score: salesPackage.commercialScore,
    sales_package: salesPackage,
    sales_pending_items: salesPackage.pendingItems,
    ready_to_sell: salesPackage.readyToSell,
    commercial_status: salesPackage.readyToSell ? "ready_to_sell" : "incomplete",
  };

  return {
    salesPackage,
    metadataPatch,
    funnelId,
    fatalError: null,
  };
}
