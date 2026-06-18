import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { ProductFactoryRepository } from "@/lib/supabase/repositories/product-factory.repository";
import { RevenueMetricsRepository } from "@/lib/supabase/repositories/revenue-ai.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import type { CreatorProduct, Json, Offer, OfferType, TableInsert } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildOfferEngineAuraContext,
  calculateExpectedAOV,
  calculateExpectedAverageTicket,
  calculateExpectedTakeRate,
  computeOfferEngineDashboard,
  computeOfferExpectedRevenue,
  generateOfferRecommendations,
  isSubscriptionProduct,
  mergeOfferMetadata,
  resolveOfferStackStrategy,
  type GeneratedOfferPayload,
  type OfferEngineDashboard,
  type OfferEngineIntake,
  type OfferStackBundle,
  type OfferStackStrategy,
} from "@/utils/offer-engine";
import { getOptionalDataContext } from "./context";

const OFFER_ENGINE_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Offer Engine Pro — arquiteta stacks de monetização para produtos digitais.
Regras:
- Ofertas complementares e coerentes com o ticket do front-end
- Copy honesta, sem promessas proibidas
- take_rate_hint entre 0 e 1
- Preços em BRL salvo indicação contrária

Responda APENAS JSON conforme solicitado.`;

type OfferIntegrationContext = {
  product: CreatorProduct;
  productName: string;
  promessa: string;
  problema: string;
  solucao: string;
  avatar: string;
  niche: string;
  frontPrice: number;
  currency: string;
  isSubscription: boolean;
  strategy: OfferStackStrategy;
  copyContext: string;
  factoryContext: string;
  growthConversionRate: number | null;
  revenueConversionRate: number | null;
  marketScore: number | null;
  decisionHints: string[];
};

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callOfferEngineAi<T>(user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: OFFER_ENGINE_SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

function resolveFrontPrice(product: CreatorProduct, override?: number): number {
  if (override != null && Number.isFinite(override) && override > 0) return override;
  if (product.faixa_preco_max != null && product.faixa_preco_max > 0) {
    return product.faixa_preco_max;
  }
  if (product.faixa_preco_min != null && product.faixa_preco_min > 0) {
    return product.faixa_preco_min;
  }
  return 97;
}

async function buildIntegrationContext(
  product: CreatorProduct,
  input: OfferEngineIntake
): Promise<OfferIntegrationContext> {
  const frontPrice = resolveFrontPrice(product, input.front_price);
  const currency = input.currency ?? product.currency ?? "BRL";

  let factoryContext = "Sem registro no Product Factory.";
  let productType: string | null = product.formato;
  const ctx = await getOptionalDataContext();
  if (ctx && input.factory_id) {
    const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
    const { data: factory } = await factoryRepo.findById(input.factory_id);
    if (factory) {
      productType = factory.product_type ?? productType;
      factoryContext = [
        `Título: ${factory.titulo ?? "—"}`,
        `Promessa: ${factory.promessa ?? "—"}`,
        `Tipo: ${factory.product_type ?? "ebook"}`,
      ].join("\n");
    }
  }

  const isSubscription = isSubscriptionProduct({
    formato: product.formato,
    nome: product.nome,
    promessa: product.promessa,
    productType,
  });
  const strategy = resolveOfferStackStrategy(frontPrice, isSubscription);

  const { records: copyRecords } = await loadCopylabRecords();
  const copy = copyRecords.find((r) => r.product_id === product.id);
  const copyContext = copy
    ? [
        `Headline: ${copy.headline ?? "—"}`,
        `Bullets: ${Array.isArray(copy.bullets) ? copy.bullets.join("; ") : "—"}`,
        `CTA: ${copy.cta ?? "—"}`,
      ].join("\n")
    : "Sem copy no CopyLab.";

  const [growthBrain, decisionEngine, marketHunter] = await Promise.all([
    import("./growth-brain.service").then((mod) => mod.getGrowthBrainDashboard()),
    import("./aura-decision-engine.service").then((mod) => mod.getUnifiedDecisionsReadOnly()),
    import("./market-hunter.service").then((mod) => mod.getMarketHunterDashboard()),
  ]);

  const growthConversionRate =
    growthBrain.dashboard?.melhorLanding?.metrics?.conversionRate ??
    growthBrain.dashboard?.melhorCampanha?.metrics?.conversionRate ??
    null;

  let revenueConversionRate: number | null = null;
  if (ctx) {
    const revenueRepo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
    const { data: metrics } = await revenueRepo.findRecent(50);
    const revenueMetric = metrics?.find((m) => m.conversions && m.clicks);
    revenueConversionRate =
      revenueMetric && revenueMetric.clicks
        ? Number(revenueMetric.conversions) / Math.max(Number(revenueMetric.clicks), 1)
        : null;
  }

  const marketScore =
    marketHunter.dashboard?.topOportunidades?.[0]?.score ??
    marketHunter.dashboard?.scoreMedio ??
    null;

  const decisionHints: string[] = [];
  const decisions = decisionEngine.decisions;
  if (decisions?.bestOffer) {
    decisionHints.push(`Oferta: ${decisions.bestOffer.label} — ${decisions.bestOffer.reason}`);
  }
  if (decisions?.bestProduct) {
    decisionHints.push(`Produto: ${decisions.bestProduct.label} — ${decisions.bestProduct.reason}`);
  }

  return {
    product,
    productName: product.nome?.trim() || "Produto digital",
    promessa: product.promessa?.trim() || "",
    problema: product.problema?.trim() || "",
    solucao: product.solucao?.trim() || "",
    avatar: product.avatar?.trim() || product.publico_alvo?.trim() || "",
    niche: product.nicho?.trim() || product.publico_alvo?.trim() || "geral",
    frontPrice,
    currency,
    isSubscription,
    strategy,
    copyContext,
    factoryContext,
    growthConversionRate,
    revenueConversionRate,
    marketScore,
    decisionHints,
  };
}

function buildOfferPrompt(
  context: OfferIntegrationContext,
  task: string,
  offerType: OfferType,
  extra?: Record<string, unknown>
): string {
  return JSON.stringify({
    task,
    offer_type: offerType,
    product: {
      nome: context.productName,
      promessa: context.promessa,
      problema: context.problema,
      solucao: context.solucao,
      avatar: context.avatar,
      niche: context.niche,
      front_price: context.frontPrice,
      currency: context.currency,
      is_subscription: context.isSubscription,
      strategy: context.strategy,
    },
    copyContext: context.copyContext,
    factoryContext: context.factoryContext,
    decisionHints: context.decisionHints,
    marketScore: context.marketScore,
    extra,
    response: {
      offer: {
        offer_type: offerType,
        title: "string",
        description: "string",
        price: "number",
        take_rate_hint: "number 0-1",
        bullets: "string[]",
        cta: "string",
        rationale: "string",
      },
    },
  });
}

async function persistGeneratedOffer(
  repo: OffersRepository,
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  payload: GeneratedOfferPayload
): Promise<{ offer: Offer | null; error: string | null }> {
  const takeRate = calculateExpectedTakeRate({
    offerType: payload.offer_type,
    frontPrice: context.frontPrice,
    takeRateHint: payload.take_rate_hint,
    growthConversionRate: context.growthConversionRate,
    marketScore: context.marketScore,
  });

  const draft = {
    funnel_id: input.funnel_id ?? null,
    product_id: input.product_id,
    offer_type: payload.offer_type,
    title: payload.title,
    description: payload.description,
    price: payload.price,
    currency: context.currency,
    expected_take_rate: takeRate,
    expected_revenue: null as number | null,
    status: "suggested" as const,
    metadata: mergeOfferMetadata({} as Json, {
      bullets: payload.bullets ?? [],
      cta: payload.cta ?? null,
      rationale: payload.rationale,
      take_rate_hint: payload.take_rate_hint,
      stack_order: payload.stack_order ?? null,
      strategy: context.strategy.label,
    }),
  } satisfies Omit<TableInsert<"offers">, "user_id">;

  draft.expected_revenue = computeOfferExpectedRevenue({
    ...draft,
    id: "",
    user_id: "",
    created_at: "",
    updated_at: "",
  } as Offer);

  const result = await repo.create(draft);
  return { offer: result.data, error: result.error };
}

async function feedIntegrationsFromOfferStack(bundle: OfferStackBundle): Promise<void> {
  const { registerCampaignResult } = await import("./growth-brain.service");
  await registerCampaignResult({
    sourcePlatform: "offer_engine",
    productId: bundle.product_id,
    revenue: bundle.metrics.expectedAov,
    spend: 0,
    roas: 0,
    conversionRate: bundle.metrics.expectedAverageTicket / Math.max(bundle.metrics.frontPrice, 1),
    metricType: "estimated",
    niche: null,
    lesson: `Offer stack · AOV R$ ${bundle.metrics.expectedAov.toFixed(2)}`,
    recommendation: bundle.recommendations[0]?.summary ?? bundle.metrics.strategy.label,
    metadata: {
      source: "offer_engine",
      funnel_id: bundle.funnel_id,
      total_offers: bundle.offers.length,
    } as Json,
  });

  const { feedMarketHunterFromGrowthBrain } = await import("./market-hunter.service");
  await feedMarketHunterFromGrowthBrain({
    productName: bundle.offers[0]?.title ?? "Produto",
    niche: null,
    score: Math.round(bundle.metrics.expectedAov),
  });
}

export { calculateExpectedTakeRate, generateOfferRecommendations };

export async function getOfferEngineDashboard(): Promise<{
  dashboard: OfferEngineDashboard;
  stacks: OfferStackBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: {
        expectedAov: 0,
        expectedAverageTicket: 0,
        expectedRevenueByFunnel: [],
        bestOfferStructure: null,
        bestUpsell: null,
        bestDownsell: null,
        totalStacks: 0,
        totalOffers: 0,
      },
      stacks: [],
      error: "Usuário não autenticado.",
    };
  }

  const offersRepo = new OffersRepository(ctx.supabase, ctx.userId);
  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const { data: offers, error } = await offersRepo.findAllOrdered();
  if (error) {
    return {
      dashboard: computeOfferEngineDashboard({ offers: [], funnelNames: {} }),
      stacks: [],
      error,
    };
  }

  const { data: funnels } = await funnelsRepo.findAllOrdered();
  const funnelNames = Object.fromEntries(
    (funnels ?? []).map((f) => [f.id, f.funnel_name])
  );

  const dashboard = computeOfferEngineDashboard({
    offers: offers ?? [],
    funnelNames,
  });

  const stackKeys = new Map<string, Offer[]>();
  for (const offer of offers ?? []) {
    const key = `${offer.product_id ?? "none"}:${offer.funnel_id ?? "none"}`;
    const group = stackKeys.get(key) ?? [];
    group.push(offer);
    stackKeys.set(key, group);
  }

  const stacks: OfferStackBundle[] = [...stackKeys.values()].map((group) => {
    const first = group[0];
    const strategy = resolveOfferStackStrategy(
      Number(group.find((o) => o.offer_type === "front_end")?.price ?? 97),
      group.some((o) => o.offer_type === "continuity")
    );
    const metrics = {
      expectedAov: calculateExpectedAOV(group),
      expectedAverageTicket: calculateExpectedAverageTicket(group),
      frontPrice: Number(group.find((o) => o.offer_type === "front_end")?.price ?? 0),
      totalOffers: group.length,
      strategy,
    };
    return {
      product_id: first.product_id ?? "",
      funnel_id: first.funnel_id,
      offers: group,
      metrics,
      recommendations: generateOfferRecommendations(group, strategy),
    };
  });

  return { dashboard, stacks, error: null };
}

export async function generateOrderBumpOffer(
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  repo: OffersRepository
): Promise<{ offer: Offer | null; error: string | null }> {
  const generated = await callOfferEngineAi<{ offer: GeneratedOfferPayload }>(
    buildOfferPrompt(context, "generate_order_bump", "order_bump", {
      instruction: "Order bump entre 15% e 40% do ticket principal.",
    })
  );
  if (!generated?.offer?.title) {
    return { offer: null, error: "Não foi possível gerar order bump." };
  }
  return persistGeneratedOffer(repo, context, input, {
    ...generated.offer,
    offer_type: "order_bump",
  });
}

export async function generateUpsellOffer(
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  repo: OffersRepository,
  index: number
): Promise<{ offer: Offer | null; error: string | null }> {
  const generated = await callOfferEngineAi<{ offer: GeneratedOfferPayload }>(
    buildOfferPrompt(context, "generate_upsell", "upsell", {
      upsell_index: index + 1,
      upsell_total: context.strategy.upsellCount,
      instruction:
        context.frontPrice <= 97
          ? "Upsell complementar agressivo para ticket baixo."
          : context.frontPrice > 197
            ? "Upsell premium enxuto para ticket alto."
            : "Upsell complementar equilibrado.",
    })
  );
  if (!generated?.offer?.title) {
    return { offer: null, error: "Não foi possível gerar upsell." };
  }
  return persistGeneratedOffer(repo, context, input, {
    ...generated.offer,
    offer_type: "upsell",
    stack_order: index + 1,
  });
}

export async function generateDownsellOffer(
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  repo: OffersRepository
): Promise<{ offer: Offer | null; error: string | null }> {
  const generated = await callOfferEngineAi<{ offer: GeneratedOfferPayload }>(
    buildOfferPrompt(context, "generate_downsell", "downsell", {
      instruction: "Downsell acessível para quem recusou upsell.",
    })
  );
  if (!generated?.offer?.title) {
    return { offer: null, error: "Não foi possível gerar downsell." };
  }
  return persistGeneratedOffer(repo, context, input, {
    ...generated.offer,
    offer_type: "downsell",
  });
}

export async function generateVipOffer(
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  repo: OffersRepository
): Promise<{ offer: Offer | null; error: string | null }> {
  const generated = await callOfferEngineAi<{ offer: GeneratedOfferPayload }>(
    buildOfferPrompt(context, "generate_vip_offer", "vip_offer", {
      instruction: "Oferta VIP exclusiva com acesso premium ou mentoria leve.",
    })
  );
  if (!generated?.offer?.title) {
    return { offer: null, error: "Não foi possível gerar oferta VIP." };
  }
  return persistGeneratedOffer(repo, context, input, {
    ...generated.offer,
    offer_type: "vip_offer",
  });
}

async function generateContinuityOffer(
  context: OfferIntegrationContext,
  input: OfferEngineIntake,
  repo: OffersRepository
): Promise<{ offer: Offer | null; error: string | null }> {
  const generated = await callOfferEngineAi<{ offer: GeneratedOfferPayload }>(
    buildOfferPrompt(context, "generate_continuity", "continuity", {
      instruction: "Plano de continuidade recorrente complementar à assinatura.",
    })
  );
  if (!generated?.offer?.title) {
    return { offer: null, error: "Não foi possível gerar continuidade." };
  }
  return persistGeneratedOffer(repo, context, input, {
    ...generated.offer,
    offer_type: "continuity",
  });
}

export async function generateOfferStack(input: OfferEngineIntake): Promise<{
  bundle: OfferStackBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const productId = input.product_id?.trim();
  if (!productId) return { bundle: null, error: "Informe product_id." };

  const { bundles } = await loadCreatorBundles();
  const productBundle = bundles.find((b) => b.product.id === productId);
  if (!productBundle) return { bundle: null, error: "Produto não encontrado." };

  const context = await buildIntegrationContext(productBundle.product, input);
  const offersRepo = new OffersRepository(ctx.supabase, ctx.userId);

  await offersRepo.deleteByProductAndFunnel(productId, input.funnel_id ?? null);

  const persisted: Offer[] = [];

  const frontTakeRate = calculateExpectedTakeRate({
    offerType: "front_end",
    frontPrice: context.frontPrice,
    takeRateHint: 1,
    growthConversionRate: context.growthConversionRate,
    marketScore: context.marketScore,
  });

  const { data: frontOffer, error: frontError } = await offersRepo.create({
    funnel_id: input.funnel_id ?? null,
    product_id: productId,
    offer_type: "front_end",
    title: productBundle.offer?.headline ?? context.productName,
    description: context.promessa,
    price: context.frontPrice,
    currency: context.currency,
    expected_take_rate: frontTakeRate,
    expected_revenue: context.frontPrice,
    status: "ready",
    metadata: mergeOfferMetadata({} as Json, {
      strategy: context.strategy.label,
      rationale: "Front-end principal do produto",
    }),
  } satisfies Omit<TableInsert<"offers">, "user_id">);

  if (frontError || !frontOffer) {
    return { bundle: null, error: frontError ?? "Erro ao salvar front-end." };
  }
  persisted.push(frontOffer);

  if (context.strategy.includeOrderBump) {
    const bump = await generateOrderBumpOffer(context, input, offersRepo);
    if (bump.offer) persisted.push(bump.offer);
  }

  for (let i = 0; i < context.strategy.upsellCount; i += 1) {
    const upsell = await generateUpsellOffer(context, input, offersRepo, i);
    if (upsell.offer) persisted.push(upsell.offer);
  }

  if (context.strategy.includeDownsell) {
    const downsell = await generateDownsellOffer(context, input, offersRepo);
    if (downsell.offer) persisted.push(downsell.offer);
  }

  if (context.strategy.includeVip) {
    const vip = await generateVipOffer(context, input, offersRepo);
    if (vip.offer) persisted.push(vip.offer);
  }

  if (context.strategy.includeContinuity) {
    const continuity = await generateContinuityOffer(context, input, offersRepo);
    if (continuity.offer) persisted.push(continuity.offer);
  }

  const metrics = {
    expectedAov: calculateExpectedAOV(persisted),
    expectedAverageTicket: calculateExpectedAverageTicket(persisted),
    frontPrice: context.frontPrice,
    totalOffers: persisted.length,
    strategy: context.strategy,
  };
  const recommendations = generateOfferRecommendations(persisted, context.strategy);

  const bundle: OfferStackBundle = {
    product_id: productId,
    funnel_id: input.funnel_id ?? null,
    offers: persisted,
    metrics,
    recommendations,
  };

  recordSystemLog({
    tipo: "info",
    modulo: "offer-engine",
    mensagem: `Offer stack gerado: ${context.productName}`,
    detalhes: {
      productId,
      funnelId: input.funnel_id ?? null,
      totalOffers: persisted.length,
      expectedAov: metrics.expectedAov,
      strategy: context.strategy.label,
    },
  });

  void feedIntegrationsFromOfferStack(bundle).catch((err) => {
    console.error("[offer-engine] integration feed failed", err);
  });

  return { bundle, error: null };
}

export async function getOfferEngineContext(): Promise<{ context: string; error: string | null }> {
  const { stacks, error } = await getOfferEngineDashboard();
  if (error) return { context: "", error };
  if (!stacks.length) return { context: "Nenhuma stack de ofertas gerada ainda.", error: null };
  return {
    context: stacks
      .slice(0, 3)
      .map((stack) => buildOfferEngineAuraContext(stack))
      .join("\n\n---\n\n"),
    error: null,
  };
}
