import { decryptCredentials } from "@/lib/crypto/credentials";
import { recordSystemLog } from "@/lib/logs/record";
import { createStripePaymentLink } from "@/lib/platforms/stripe.client";
import { CheckoutProductsRepository } from "@/lib/supabase/repositories/checkout-products.repository";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import {
  KiwifyConnectionsRepository,
  KiwifyProductsRepository,
} from "@/lib/supabase/repositories/kiwify-connect.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { AffiliateProductsRepository } from "@/lib/supabase/repositories/platform-hub.repository";
import { PlatformConnectionsRepository } from "@/lib/supabase/repositories/platform-hub.repository";
import { logIntegrationAction } from "@/lib/supabase/services/integration-logs.service";
import type {
  CheckoutPlatform,
  CheckoutProduct,
  Json,
  TableInsert,
} from "@/types/database";
import {
  buildHotmartCheckoutUrl,
  buildKiwifyCheckoutUrl,
  CHECKOUT_PLATFORM_PRIORITY,
  DEFAULT_CHECKOUT_PRICE_CENTS,
  isCheckoutReady,
  mergeCheckoutMetadata,
  resolveCheckoutLocale,
  scoreProductNameMatch,
  slugifyCheckoutId,
} from "@/utils/checkout-engine";
import { localeFromFields } from "@/utils/creator-locale";
import { buildLandingPageHtml } from "@/utils/landing-factory";
import { mergeFunnelMetadata } from "@/utils/funnel-engine";
import { mergeFunnelPageMetadata } from "@/utils/funnel-pages";
import { getOptionalDataContext } from "./context";

export type CreateCheckoutInput = {
  productId: string;
  platform?: CheckoutPlatform;
  priceCents?: number;
  currency?: string;
  productName?: string;
};

type ProductCheckoutContext = {
  productId: string;
  productName: string;
  priceCents: number;
  currency: string;
};

async function loadProductCheckoutContext(
  productId: string
): Promise<{ context: ProductCheckoutContext | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: null, error: "Usuário não autenticado." };

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const offersRepo = new OffersRepository(ctx.supabase, ctx.userId);

  const { data: product, error } = await productsRepo.findById(productId);
  if (error || !product) {
    return { context: null, error: error ?? "Produto não encontrado." };
  }

  const { data: offers } = await offersRepo.findByProductId(productId);
  const frontOffer =
    (offers ?? []).find((offer) => offer.offer_type === "front_end") ?? (offers ?? [])[0];

  const locale = localeFromFields(product);

  const priceCents = frontOffer?.price
    ? Math.round(Number(frontOffer.price) * 100)
    : DEFAULT_CHECKOUT_PRICE_CENTS;

  const currency =
    frontOffer?.currency?.trim() ||
    product.currency?.trim() ||
    locale.currency;

  return {
    context: {
      productId,
      productName: product.nome?.trim() || "Produto digital Aura",
      priceCents: Number.isFinite(priceCents) && priceCents > 0 ? priceCents : DEFAULT_CHECKOUT_PRICE_CENTS,
      currency: resolveCheckoutLocale({
        country: product.target_country,
        language: product.target_language,
        currency,
      }).currency,
    },
    error: null,
  };
}

async function resolvePreferredPlatform(): Promise<{
  platform: CheckoutPlatform | null;
  credentials: Record<string, string> | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { platform: null, credentials: null };

  const platformRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const kiwifyConnRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);

  for (const platform of CHECKOUT_PLATFORM_PRIORITY) {
    if (platform === "kiwify") {
      const { data: kiwifyConn } = await kiwifyConnRepo.findForUser();
      if (kiwifyConn?.status === "connected") {
        try {
          const creds = decryptCredentials(kiwifyConn.credentials_encrypted);
          return { platform: "kiwify", credentials: creds };
        } catch {
          continue;
        }
      }
      continue;
    }

    const { data: connection } = await platformRepo.findByPlatform(platform);
    if (!connection || connection.status !== "connected") continue;

    try {
      const creds = decryptCredentials(connection.credentials_encrypted);
      return { platform, credentials: creds };
    } catch {
      continue;
    }
  }

  return { platform: null, credentials: null };
}

async function createStripeCheckoutRecord(
  context: ProductCheckoutContext,
  credentials: Record<string, string>
): Promise<{
  checkoutId: string;
  checkoutUrl: string;
  status: CheckoutProduct["status"];
  metadata: Json;
}> {
  const secretKey =
    credentials.secret_key?.trim() ||
    credentials.api_key?.trim() ||
    credentials.stripe_secret_key?.trim();
  if (!secretKey) {
    throw new Error("Credenciais Stripe inválidas.");
  }

  const { checkoutId, checkoutUrl } = await createStripePaymentLink({
    secretKey,
    productName: context.productName,
    priceCents: context.priceCents,
    currency: context.currency,
  });

  return {
    checkoutId,
    checkoutUrl,
    status: "ready_to_sell",
    metadata: mergeCheckoutMetadata({}, {
      price_cents: context.priceCents,
      currency: context.currency,
      source: "stripe_payment_link",
    }),
  };
}

async function createKiwifyCheckoutRecord(
  context: ProductCheckoutContext
): Promise<{
  checkoutId: string;
  checkoutUrl: string | null;
  status: CheckoutProduct["status"];
  metadata: Json;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) throw new Error("Usuário não autenticado.");

  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);
  const { data: products } = await productsRepo.findAllOrdered();

  let bestMatch: { id: string; name: string; score: number } | null = null;
  for (const product of products ?? []) {
    const score = scoreProductNameMatch(context.productName, product.name);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: product.external_product_id, name: product.name, score };
    }
  }

  if (bestMatch && bestMatch.score >= 50) {
    const checkoutId = bestMatch.id;
    return {
      checkoutId,
      checkoutUrl: buildKiwifyCheckoutUrl(checkoutId),
      status: "ready_to_sell",
      metadata: mergeCheckoutMetadata({}, {
        matched_product_name: bestMatch.name,
        match_score: bestMatch.score,
        price_cents: context.priceCents,
        currency: context.currency,
        source: "kiwify_catalog_match",
      }),
    };
  }

  const checkoutId = `${slugifyCheckoutId(context.productName)}-${context.productId.slice(0, 8)}`;
  return {
    checkoutId,
    checkoutUrl: null,
    status: "pending",
    metadata: mergeCheckoutMetadata({}, {
      price_cents: context.priceCents,
      currency: context.currency,
      source: "kiwify_staged",
      awaiting_platform_product: true,
    }),
  };
}

async function createHotmartCheckoutRecord(
  context: ProductCheckoutContext
): Promise<{
  checkoutId: string;
  checkoutUrl: string | null;
  status: CheckoutProduct["status"];
  metadata: Json;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) throw new Error("Usuário não autenticado.");

  const affiliateRepo = new AffiliateProductsRepository(ctx.supabase, ctx.userId);
  const { data: products } = await affiliateRepo.findAllOrdered();
  const hotmartProducts = (products ?? []).filter((p) => p.platform === "hotmart");

  let bestMatch: { id: string; name: string; score: number } | null = null;
  for (const product of hotmartProducts) {
    const score = scoreProductNameMatch(context.productName, product.name);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: product.external_product_id, name: product.name, score };
    }
  }

  if (bestMatch && bestMatch.score >= 50) {
    const checkoutId = bestMatch.id;
    return {
      checkoutId,
      checkoutUrl: buildHotmartCheckoutUrl(checkoutId),
      status: "ready_to_sell",
      metadata: mergeCheckoutMetadata({}, {
        matched_product_name: bestMatch.name,
        match_score: bestMatch.score,
        price_cents: context.priceCents,
        currency: context.currency,
        source: "hotmart_catalog_match",
      }),
    };
  }

  const checkoutId = `${slugifyCheckoutId(context.productName)}-${context.productId.slice(0, 8)}`;
  return {
    checkoutId,
    checkoutUrl: null,
    status: "pending",
    metadata: mergeCheckoutMetadata({}, {
      price_cents: context.priceCents,
      currency: context.currency,
      source: "hotmart_staged",
      awaiting_platform_product: true,
    }),
  };
}

async function feedCheckoutIntegrations(
  checkout: CheckoutProduct,
  context: ProductCheckoutContext,
  intentCountry?: string | null
): Promise<void> {
  if (!isCheckoutReady(checkout.status) || !checkout.checkout_url) return;

  const { registerCampaignResult } = await import("./growth-brain.service");
  void registerCampaignResult({
    productId: context.productId,
    sourcePlatform: "checkout_engine",
    country: intentCountry ?? (context.currency === "USD" ? "US" : "BR"),
    revenue: context.priceCents / 100,
    spend: 0,
    roas: 0,
    conversionRate: 0.03,
    metricType: "estimated",
    lesson: `Checkout ${checkout.platform} pronto para ${context.productName}`,
    recommendation: checkout.checkout_url,
    metadata: {
      source: "checkout_engine",
      checkout_id: checkout.checkout_id,
      platform: checkout.platform,
    } as Json,
  }).catch(() => undefined);

  const { registerTruthRevenue } = await import("./revenue-truth-engine.service");
  void registerTruthRevenue({
    productId: context.productId,
    platform: checkout.platform,
    country: intentCountry ?? undefined,
    currency: context.currency,
    revenue: context.priceCents / 100,
    spend: 0,
    metricType: "estimated",
    hasPlatformConnection: isCheckoutReady(checkout.status),
    metadata: {
      source: "checkout_engine",
      checkout_url: checkout.checkout_url,
      checkout_id: checkout.id,
    },
  }).catch(() => undefined);
}

export async function applyCheckoutToProduct(productId: string): Promise<{
  updatedLandings: number;
  updatedFunnels: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { updatedLandings: 0, updatedFunnels: 0, error: "Usuário não autenticado." };

  const { checkoutUrl, error: urlError } = await getCheckoutUrl(productId);
  if (urlError || !checkoutUrl) {
    return { updatedLandings: 0, updatedFunnels: 0, error: urlError ?? "Checkout URL indisponível." };
  }

  const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
  const checkoutRepo = new CheckoutProductsRepository(ctx.supabase, ctx.userId);

  const { data: checkout } = await checkoutRepo.findReadyByProductId(productId);

  const { data: landings } = await landingRepo.findAllOrdered();
  let updatedLandings = 0;
  for (const landing of landings ?? []) {
    if (landing.product_id !== productId) continue;

    const html = buildLandingPageHtml(
      {
        title: landing.title,
        headline: landing.headline,
        subheadline: landing.subheadline,
        hero_copy: landing.hero_copy,
        benefits_json: landing.benefits_json,
        proof_json: landing.proof_json,
        offer_json: landing.offer_json,
        faq_json: landing.faq_json,
        cta_text: landing.cta_text,
      },
      checkoutUrl
    );

    await landingRepo.update(landing.id, {
      html,
      metadata: mergeCheckoutMetadata(landing.metadata, {
        checkout_url: checkoutUrl,
        checkout_product_id: checkout?.id ?? null,
        checkout_platform: checkout?.platform ?? null,
      }),
    });
    updatedLandings += 1;
  }

  const { data: funnels } = await funnelsRepo.findAllOrdered();
  let updatedFunnels = 0;
  for (const funnel of funnels ?? []) {
    if (funnel.product_id !== productId) continue;

    await funnelsRepo.update(funnel.id, {
      metadata: mergeFunnelMetadata(funnel.metadata, {
        checkout_url: checkoutUrl,
        checkout_product_id: checkout?.id ?? null,
        checkout_platform: checkout?.platform ?? null,
        ready_to_sell: true,
      }),
    });
    updatedFunnels += 1;

    const { data: pages } = await pagesRepo.findByFunnelId(funnel.id);
    for (const page of pages ?? []) {
      await pagesRepo.update(page.id, {
        metadata: mergeFunnelPageMetadata(page.metadata, {
          checkout_url: checkoutUrl,
          checkout_product_id: checkout?.id ?? null,
        }),
      });
    }
  }

  return { updatedLandings, updatedFunnels, error: null };
}

export async function createCheckout(input: CreateCheckoutInput): Promise<{
  checkout: CheckoutProduct | null;
  message: string;
  error: string | null;
}> {
  const productId = input.productId.trim();
  if (!productId) {
    return { checkout: null, message: "", error: "Informe product_id." };
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { checkout: null, message: "", error: "Usuário não autenticado." };
  }

  const { context, error: contextError } = await loadProductCheckoutContext(productId);
  if (contextError || !context) {
    return { checkout: null, message: "", error: contextError ?? "Produto não encontrado." };
  }

  const preferred = input.platform
    ? { platform: input.platform, credentials: null as Record<string, string> | null }
    : await resolvePreferredPlatform();

  const platform = input.platform ?? preferred.platform ?? "stripe";
  const repo = new CheckoutProductsRepository(ctx.supabase, ctx.userId);

  const { data: existing } = await repo.findByProductAndPlatform(productId, platform);
  if (existing && isCheckoutReady(existing.status) && existing.checkout_url) {
    return {
      checkout: existing,
      message: "Checkout já disponível para venda.",
      error: null,
    };
  }

  let credentials = preferred.credentials;
  if (input.platform && platform !== "kiwify") {
    const platformRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
    const { data: connection } = await platformRepo.findByPlatform(platform);
    if (connection?.status === "connected") {
      try {
        credentials = decryptCredentials(connection.credentials_encrypted);
      } catch {
        credentials = null;
      }
    }
  }

  if (platform === "kiwify") {
    const kiwifyConnRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
    const { data: kiwifyConn } = await kiwifyConnRepo.findForUser();
    if (kiwifyConn?.status === "connected") {
      try {
        credentials = decryptCredentials(kiwifyConn.credentials_encrypted);
      } catch {
        credentials = null;
      }
    }
  }

  const priceCents = input.priceCents ?? context.priceCents;
  const productName = input.productName ?? context.productName;
  const checkoutContext = { ...context, priceCents, productName };

  try {
    let result: {
      checkoutId: string;
      checkoutUrl: string | null;
      status: CheckoutProduct["status"];
      metadata: Json;
    };

    if (platform === "stripe") {
      if (!credentials) {
        result = {
          checkoutId: `${slugifyCheckoutId(checkoutContext.productName)}-${productId.slice(0, 8)}`,
          checkoutUrl: null,
          status: "pending",
          metadata: mergeCheckoutMetadata({}, {
            price_cents: priceCents,
            currency: checkoutContext.currency,
            source: "stripe_staged",
            awaiting_platform_connection: true,
          }),
        };
      } else {
        result = await createStripeCheckoutRecord(checkoutContext, credentials);
      }
    } else if (platform === "kiwify") {
      if (!credentials) {
        result = {
          checkoutId: `${slugifyCheckoutId(checkoutContext.productName)}-${productId.slice(0, 8)}`,
          checkoutUrl: null,
          status: "pending",
          metadata: mergeCheckoutMetadata({}, {
            price_cents: priceCents,
            currency: checkoutContext.currency,
            source: "kiwify_staged",
            awaiting_platform_connection: true,
          }),
        };
      } else {
        await import("./kiwify-connect.service")
          .then((mod) => mod.syncKiwifyConnection())
          .catch(() => undefined);
        result = await createKiwifyCheckoutRecord(checkoutContext);
      }
    } else {
      if (!credentials) {
        result = {
          checkoutId: `${slugifyCheckoutId(checkoutContext.productName)}-${productId.slice(0, 8)}`,
          checkoutUrl: null,
          status: "pending",
          metadata: mergeCheckoutMetadata({}, {
            price_cents: priceCents,
            currency: checkoutContext.currency,
            source: "hotmart_staged",
            awaiting_platform_connection: true,
          }),
        };
      } else {
        await import("./platform-hub.service")
          .then((mod) => mod.syncPlatformConnection("hotmart"))
          .catch(() => undefined);
        result = await createHotmartCheckoutRecord(checkoutContext);
      }
    }

    const payload = {
      product_id: productId,
      platform,
      checkout_id: result.checkoutId,
      checkout_url: result.checkoutUrl,
      status: result.status,
      metadata: result.metadata,
    } satisfies Omit<TableInsert<"checkout_products">, "user_id">;

    const { data: checkout, error: saveError } = existing
      ? await repo.update(existing.id, payload)
      : await repo.create(payload);

    if (saveError || !checkout) {
      return {
        checkout: null,
        message: "",
        error: saveError ?? "Erro ao salvar checkout.",
      };
    }

    if (isCheckoutReady(checkout.status) && checkout.checkout_url) {
      await feedCheckoutIntegrations(checkout, checkoutContext);
      void applyCheckoutToProduct(productId).catch((err) => {
        console.error("[checkout-engine] apply to product failed", err);
      });
    }

    await logIntegrationAction({
      platform: "kiwify",
      actionType: "create_checkout",
      status: isCheckoutReady(checkout.status) ? "success" : "pending_approval",
      message: `Checkout ${platform} para ${productName}`,
      details: {
        productId,
        checkoutId: checkout.checkout_id,
        checkoutUrl: checkout.checkout_url,
        status: checkout.status,
        checkout_platform: platform,
      },
    });

    recordSystemLog({
      tipo: "info",
      modulo: "checkout-engine",
      mensagem: `Checkout criado (${platform}) — ${productName}`,
      detalhes: {
        productId,
        checkoutId: checkout.checkout_id,
        status: checkout.status,
      },
    });

    return {
      checkout,
      message: isCheckoutReady(checkout.status)
        ? `Checkout pronto para venda (${platform}).`
        : `Checkout criado em ${platform} — aguardando sincronização.`,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar checkout.";
    return { checkout: null, message: "", error: message };
  }
}

export async function syncCheckout(checkoutId: string): Promise<{
  checkout: CheckoutProduct | null;
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { checkout: null, message: "", error: "Usuário não autenticado." };

  const repo = new CheckoutProductsRepository(ctx.supabase, ctx.userId);
  const { data: row, error: findError } = await repo.findById(checkoutId);
  if (findError || !row) {
    return { checkout: null, message: "", error: findError ?? "Checkout não encontrado." };
  }

  const { context, error: contextError } = await loadProductCheckoutContext(row.product_id);
  if (contextError || !context) {
    return { checkout: null, message: "", error: contextError ?? "Produto não encontrado." };
  }

  await repo.update(row.id, { status: "syncing" });

  try {
    if (row.platform === "kiwify") {
      await import("./kiwify-connect.service")
        .then((mod) => mod.syncKiwifyConnection())
        .catch(() => undefined);
    } else if (row.platform === "hotmart") {
      await import("./platform-hub.service")
        .then((mod) => mod.syncPlatformConnection("hotmart"))
        .catch(() => undefined);
    }

    let result: {
      checkoutId: string;
      checkoutUrl: string | null;
      status: CheckoutProduct["status"];
      metadata: Json;
    };

    if (row.platform === "stripe") {
      if (row.checkout_url) {
        result = {
          checkoutId: row.checkout_id,
          checkoutUrl: row.checkout_url,
          status: "ready_to_sell",
          metadata: row.metadata,
        };
      } else {
        const platformRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
        const { data: connection } = await platformRepo.findByPlatform("stripe");
        if (!connection || connection.status !== "connected") {
          throw new Error("Stripe não conectado.");
        }
        const credentials = decryptCredentials(connection.credentials_encrypted);
        result = await createStripeCheckoutRecord(context, credentials);
      }
    } else if (row.platform === "kiwify") {
      result = await createKiwifyCheckoutRecord(context);
    } else {
      result = await createHotmartCheckoutRecord(context);
    }

    const { data: checkout, error: updateError } = await repo.update(row.id, {
      checkout_id: result.checkoutId,
      checkout_url: result.checkoutUrl,
      status: result.status,
      metadata: mergeCheckoutMetadata(row.metadata, {
        ...((result.metadata as Record<string, unknown>) ?? {}),
        synced_at: new Date().toISOString(),
      }),
    });

    if (updateError || !checkout) {
      return { checkout: null, message: "", error: updateError ?? "Erro ao sincronizar checkout." };
    }

    if (isCheckoutReady(checkout.status) && checkout.checkout_url) {
      await feedCheckoutIntegrations(checkout, context);
      void applyCheckoutToProduct(checkout.product_id).catch(() => undefined);
    }

    return {
      checkout,
      message: isCheckoutReady(checkout.status)
        ? "Checkout sincronizado — READY_TO_SELL."
        : "Checkout sincronizado — ainda pendente na plataforma.",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar checkout.";
    await repo.update(row.id, {
      status: "failed",
      metadata: mergeCheckoutMetadata(row.metadata, {
        sync_error: message,
        sync_failed_at: new Date().toISOString(),
      }),
    });
    return { checkout: null, message: "", error: message };
  }
}

export async function getCheckoutUrl(productId: string): Promise<{
  checkoutUrl: string | null;
  checkout: CheckoutProduct | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { checkoutUrl: null, checkout: null, error: "Usuário não autenticado." };

  const repo = new CheckoutProductsRepository(ctx.supabase, ctx.userId);
  const { data: checkout, error } = await repo.findReadyByProductId(productId.trim());
  if (error) return { checkoutUrl: null, checkout: null, error };
  if (!checkout?.checkout_url) {
    return { checkoutUrl: null, checkout: checkout ?? null, error: null };
  }

  return {
    checkoutUrl: checkout.checkout_url,
    checkout,
    error: null,
  };
}

export async function ensureCheckoutForProduct(productId: string): Promise<void> {
  const { checkout } = await createCheckout({ productId });
  if (checkout?.checkout_url) {
    await applyCheckoutToProduct(productId);
  }
}
