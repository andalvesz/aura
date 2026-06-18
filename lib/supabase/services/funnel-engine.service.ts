import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import {
  FunnelStepsRepository,
  FunnelsRepository,
} from "@/lib/supabase/repositories/funnel-engine.repository";
import { ProductFactoryRepository } from "@/lib/supabase/repositories/product-factory.repository";
import { RevenueMetricsRepository } from "@/lib/supabase/repositories/revenue-ai.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { generateLandingPage } from "@/lib/supabase/services/landing-factory.service";
import type { CreatorCopylab, Funnel, FunnelStep, FunnelStepType, Json, TableInsert } from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildFunnelEngineAuraContext,
  calculateExpectedAOV,
  calculateExpectedConversion,
  computeFunnelEngineDashboard,
  generateFunnelMap,
  mergeFunnelMetadata,
  type FunnelBundle,
  type FunnelEngineDashboardMetrics,
  type FunnelEngineIntake,
  type GeneratedFunnelOffer,
} from "@/utils/funnel-engine";
import { getOptionalDataContext } from "./context";

const FUNNEL_ENGINE_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Funnel Engine — arquiteta funis de vendas digitais completos.
Regras:
- Ofertas complementares ao produto principal, nunca genéricas
- Preços coerentes com o ticket do front-end
- Copy honesta, sem promessas proibidas
- take_rate_hint entre 0 e 1 (ex.: 0.32 = 32%)

Responda APENAS JSON conforme solicitado.`;

type FunnelIntegrationContext = {
  productName: string;
  promessa: string;
  problema: string;
  solucao: string;
  avatar: string;
  niche: string;
  frontPrice: number;
  copyContext: string;
  factoryContext: string;
  growthConversionRate: number | null;
  revenueConversionRate: number | null;
  decisionHints: string[];
};

type StepDraft = Omit<TableInsert<"funnel_steps">, "funnel_id">;

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

async function callFunnelEngineAi<T>(user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: FUNNEL_ENGINE_SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

function resolveFrontPrice(bundlePriceMin?: number | null, bundlePriceMax?: number | null, override?: number) {
  if (override != null && Number.isFinite(override) && override > 0) return override;
  if (bundlePriceMax != null && bundlePriceMax > 0) return bundlePriceMax;
  if (bundlePriceMin != null && bundlePriceMin > 0) return bundlePriceMin;
  return 97;
}

function offerToStepMetadata(offer: GeneratedFunnelOffer): Json {
  return {
    nome: offer.nome,
    headline: offer.headline,
    promessa: offer.promessa,
    price: offer.preco,
    preco_original: offer.preco_original ?? null,
    bullets: offer.bullets,
    cta: offer.cta,
    take_rate: offer.take_rate_hint,
    rationale: offer.rationale,
  } as Json;
}

async function buildIntegrationContext(
  input: FunnelEngineIntake,
  productBundle: Awaited<ReturnType<typeof loadCreatorBundles>>["bundles"][number] | null
): Promise<FunnelIntegrationContext> {
  const product = productBundle?.product;
  const niche =
    input.niche?.trim() ||
    product?.nicho?.trim() ||
    product?.publico_alvo?.trim() ||
    product?.avatar?.trim() ||
    "geral";

  const frontPrice = resolveFrontPrice(
    product?.faixa_preco_min,
    product?.faixa_preco_max,
    input.front_price
  );

  const { records: copyRecords } = await loadCopylabRecords();
  let copy: CreatorCopylab | null = null;
  if (input.copylab_id) {
    copy = copyRecords.find((r) => r.id === input.copylab_id) ?? null;
  } else if (product?.id) {
    copy = copyRecords.find((r) => r.product_id === product.id) ?? null;
  }

  const copyContext = copy
    ? [
        `Headline: ${copy.headline ?? "—"}`,
        `Subheadline: ${copy.subheadline ?? "—"}`,
        `Big idea: ${copy.big_idea ?? "—"}`,
        `Bullets: ${Array.isArray(copy.bullets) ? copy.bullets.join("; ") : "—"}`,
        `CTA: ${copy.cta ?? "—"}`,
      ].join("\n")
    : "Sem copy no CopyLab — use promessa e avatar do produto.";

  let factoryContext = "Sem registro no Product Factory.";
  if (input.factory_id) {
    const ctx = await getOptionalDataContext();
    if (ctx) {
      const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
      const { data: factory } = await factoryRepo.findById(input.factory_id);
      if (factory) {
        factoryContext = [
          `Título: ${factory.titulo ?? "—"}`,
          `Promessa: ${factory.promessa ?? "—"}`,
          `Problema: ${factory.problema ?? "—"}`,
          `Tipo: ${factory.product_type ?? "ebook"}`,
          `Status: ${factory.status}`,
        ].join("\n");
      }
    }
  }

  const ctx = await getOptionalDataContext();
  const [growthBrain, decisionEngine] = await Promise.all([
    import("./growth-brain.service").then((mod) => mod.getGrowthBrainDashboard()),
    import("./aura-decision-engine.service").then((mod) => mod.getUnifiedDecisionsReadOnly()),
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

  const decisionHints: string[] = [];
  const decisions = decisionEngine.decisions;
  if (decisions?.bestProduct) {
    decisionHints.push(`Produto: ${decisions.bestProduct.label} — ${decisions.bestProduct.reason}`);
  }
  if (decisions?.bestOffer) {
    decisionHints.push(`Oferta: ${decisions.bestOffer.label} — ${decisions.bestOffer.reason}`);
  }
  if (decisions?.bestLanding) {
    decisionHints.push(`Landing: ${decisions.bestLanding.label} — ${decisions.bestLanding.reason}`);
  }

  return {
    productName: product?.nome?.trim() || input.funnel_name?.trim() || "Produto digital",
    promessa: product?.promessa?.trim() || copy?.promessa?.trim() || "",
    problema: product?.problema?.trim() || copy?.problema?.trim() || "",
    solucao: product?.solucao?.trim() || copy?.solucao?.trim() || "",
    avatar: product?.avatar?.trim() || copy?.avatar?.trim() || "",
    niche,
    frontPrice,
    copyContext,
    factoryContext,
    growthConversionRate,
    revenueConversionRate,
    decisionHints,
  };
}

async function feedIntegrationsFromFunnel(bundle: FunnelBundle): Promise<void> {
  const { registerCampaignResult } = await import("./growth-brain.service");
  await registerCampaignResult({
    sourcePlatform: "funnel_engine",
    productId: bundle.funnel.product_id,
    operationId: bundle.funnel.operation_id,
    revenue: bundle.map.expected_aov,
    spend: 0,
    roas: 0,
    conversionRate: bundle.map.expected_conversion,
    metricType: "estimated",
    niche: bundle.funnel.niche,
    lesson: `Funil ${bundle.funnel.funnel_name} · AOV R$ ${bundle.map.expected_aov.toFixed(2)}`,
    recommendation: bundle.map.summary,
    metadata: {
      source: "funnel_engine",
      funnel_id: bundle.funnel.id,
      funnel_name: bundle.funnel.funnel_name,
    } as Json,
  });

  if (bundle.funnel.operation_id) {
    const { syncOperationCenterState } = await import("./operation-center.service");
    await syncOperationCenterState();
  }
}

export async function getFunnelEngineDashboard(): Promise<{
  dashboard: FunnelEngineDashboardMetrics;
  bundles: FunnelBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: {
        total: 0,
        ready: 0,
        active: 0,
        avgExpectedAov: 0,
        avgExpectedConversion: 0,
      },
      bundles: [],
      error: "Usuário não autenticado.",
    };
  }

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const stepsRepo = new FunnelStepsRepository(ctx.supabase, ctx.userId);
  const { data: funnels, error } = await funnelsRepo.findAllOrdered();
  if (error) return { dashboard: computeFunnelEngineDashboard([]), bundles: [], error };

  const bundles: FunnelBundle[] = [];
  for (const funnel of funnels ?? []) {
    const { data: steps } = await stepsRepo.findByFunnelId(funnel.id);
    const map = generateFunnelMap(funnel, steps ?? []);
    bundles.push({ funnel, steps: steps ?? [], map });
  }

  return {
    dashboard: computeFunnelEngineDashboard(funnels ?? []),
    bundles,
    error: null,
  };
}

export async function generateOrderBump(
  context: FunnelIntegrationContext,
  productId: string
): Promise<{ step: StepDraft | null; error: string | null }> {
  const generated = await callFunnelEngineAi<{ offer: GeneratedFunnelOffer }>(
    JSON.stringify({
      task: "generate_order_bump",
      product: context,
      instruction:
        "Sugira um order bump complementar ao front-end, preço entre 15% e 40% do ticket principal.",
      response: {
        offer: {
          step_type: "order_bump",
          nome: "string",
          headline: "string",
          promessa: "string",
          preco: "number",
          preco_original: "number?",
          bullets: "string[]",
          cta: "string",
          take_rate_hint: "number 0-1",
          rationale: "string",
        },
      },
    })
  );

  const offer = generated?.offer;
  if (!offer?.headline) {
    return { step: null, error: "Não foi possível gerar o order bump." };
  }

  return {
    step: {
      step_order: 2,
      step_type: "order_bump",
      product_id: productId,
      landing_id: null,
      copy_id: null,
      creative_id: null,
      offer_id: null,
      status: "suggested",
      metadata: offerToStepMetadata({ ...offer, step_type: "order_bump" }),
    },
    error: null,
  };
}

export async function generateUpsell(
  context: FunnelIntegrationContext,
  productId: string
): Promise<{ steps: StepDraft[]; error: string | null }> {
  const generated = await callFunnelEngineAi<{ upsells: GeneratedFunnelOffer[] }>(
    JSON.stringify({
      task: "generate_upsells",
      product: context,
      instruction:
        "Sugira upsell_1 (complemento principal) e upsell_2 (acelerador ou mentoria leve). Preços progressivos acima do front-end.",
      response: {
        upsells: [
          {
            step_type: "upsell_1 | upsell_2",
            nome: "string",
            headline: "string",
            promessa: "string",
            preco: "number",
            bullets: "string[]",
            cta: "string",
            take_rate_hint: "number 0-1",
            rationale: "string",
          },
        ],
      },
    })
  );

  const upsells = generated?.upsells ?? [];
  if (upsells.length < 1) {
    return { steps: [], error: "Não foi possível gerar upsells." };
  }

  const normalized: GeneratedFunnelOffer[] = [];
  const upsell1 =
    upsells.find((u) => u.step_type === "upsell_1") ??
    ({ ...upsells[0], step_type: "upsell_1" } as GeneratedFunnelOffer);
  normalized.push(upsell1);

  const upsell2 =
    upsells.find((u) => u.step_type === "upsell_2") ??
    (upsells[1]
      ? ({ ...upsells[1], step_type: "upsell_2" } as GeneratedFunnelOffer)
      : null);

  if (upsell2) normalized.push(upsell2);

  const steps: StepDraft[] = [];
  for (const [index, offer] of normalized.entries()) {
    steps.push({
      step_order: 3 + index,
      step_type: offer.step_type === "upsell_2" ? "upsell_2" : "upsell_1",
      product_id: productId,
      landing_id: null,
      copy_id: null,
      creative_id: null,
      offer_id: null,
      status: "suggested",
      metadata: offerToStepMetadata(offer),
    });
  }

  return { steps, error: null };
}

export async function generateDownsell(
  context: FunnelIntegrationContext,
  productId: string
): Promise<{ step: StepDraft | null; error: string | null }> {
  const generated = await callFunnelEngineAi<{ offer: GeneratedFunnelOffer }>(
    JSON.stringify({
      task: "generate_downsell",
      product: context,
      instruction:
        "Sugira um downsell para quem recusou o upsell — versão mais acessível ou parcelada do complemento.",
      response: {
        offer: {
          step_type: "downsell",
          nome: "string",
          headline: "string",
          promessa: "string",
          preco: "number",
          bullets: "string[]",
          cta: "string",
          take_rate_hint: "number 0-1",
          rationale: "string",
        },
      },
    })
  );

  const offer = generated?.offer;
  if (!offer?.headline) {
    return { step: null, error: "Não foi possível gerar o downsell." };
  }

  return {
    step: {
      step_order: 5,
      step_type: "downsell",
      product_id: productId,
      landing_id: null,
      copy_id: null,
      creative_id: null,
      offer_id: null,
      status: "suggested",
      metadata: offerToStepMetadata({ ...offer, step_type: "downsell" }),
    },
    error: null,
  };
}

export { calculateExpectedAOV, calculateExpectedConversion, generateFunnelMap };

export async function generateFunnel(input: FunnelEngineIntake): Promise<{
  bundle: FunnelBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const productId = input.product_id?.trim();
  if (!productId) return { bundle: null, error: "Informe o product_id." };

  const { bundles } = await loadCreatorBundles();
  const productBundle = bundles.find((b) => b.product.id === productId) ?? null;
  if (!productBundle) {
    return { bundle: null, error: "Produto não encontrado." };
  }

  const integrationContext = await buildIntegrationContext(input, productBundle);
  const funnelName =
    input.funnel_name?.trim() ||
    productBundle.product.nome?.trim() ||
    `Funil ${integrationContext.productName}`;

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const stepsRepo = new FunnelStepsRepository(ctx.supabase, ctx.userId);

  const { data: funnel, error: createError } = await funnelsRepo.create({
    operation_id: input.operation_id?.trim() || null,
    product_id: productId,
    funnel_name: funnelName,
    niche: integrationContext.niche,
    status: "generating",
    funnel_type: input.funnel_type ?? "standard",
    total_steps: 0,
    expected_aov: null,
    expected_conversion: null,
    metadata: mergeFunnelMetadata({} as Json, {
      factory_id: input.factory_id ?? null,
      copylab_id: input.copylab_id ?? null,
      integrations: {
        product_factory: Boolean(input.factory_id),
        copylab: Boolean(input.copylab_id),
        landing_factory: input.auto_generate_landing !== false,
        revenue_ai: integrationContext.revenueConversionRate != null,
        growth_brain: integrationContext.growthConversionRate != null,
        decision_engine: integrationContext.decisionHints.length > 0,
      },
    }),
  } satisfies Omit<TableInsert<"funnels">, "user_id">);

  if (createError || !funnel) {
    return { bundle: null, error: createError ?? "Erro ao criar funil." };
  }

  const stepDrafts: StepDraft[] = [];
  let copyId = input.copylab_id ?? null;
  let landingId: string | null = null;

  if (input.auto_generate_landing !== false) {
    const { page } = await generateLandingPage({
      operation_id: input.operation_id ?? null,
      product_id: productId,
      copylab_id: copyId,
      titulo: funnelName,
      promessa: integrationContext.promessa,
      avatar: integrationContext.avatar,
      problema: integrationContext.problema,
      solucao: integrationContext.solucao,
    });
    landingId = page?.id ?? null;
  }

  stepDrafts.push({
    step_order: 1,
    step_type: "front_end",
    product_id: productId,
    landing_id: landingId,
    copy_id: copyId,
    creative_id: null,
    offer_id: productBundle.offer?.id ?? null,
    status: landingId ? "ready" : "suggested",
    metadata: {
      price: integrationContext.frontPrice,
      take_rate: 1,
      headline: productBundle.offer?.headline ?? integrationContext.promessa,
      nome: funnelName,
    } as Json,
  });

  const bumpResult = await generateOrderBump(integrationContext, productId);
  if (bumpResult.step) stepDrafts.push(bumpResult.step);

  const upsellResult = await generateUpsell(integrationContext, productId);
  stepDrafts.push(...upsellResult.steps);

  const downsellResult = await generateDownsell(integrationContext, productId);
  if (downsellResult.step) stepDrafts.push(downsellResult.step);

  const thankYouOrder =
    stepDrafts.reduce((max, step) => Math.max(max, step.step_order ?? 0), 0) + 1;

  stepDrafts.push({
    step_order: thankYouOrder,
    step_type: "thank_you",
    product_id: productId,
    landing_id: landingId,
    copy_id: copyId,
    creative_id: null,
    offer_id: null,
    status: "ready",
    metadata: {
      message: "Obrigado pela compra! Acesse seu produto e confira os bônus liberados.",
    } as Json,
  });

  const persistedSteps: FunnelStep[] = [];
  for (const draft of stepDrafts.sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))) {
    const { data: step, error: stepError } = await stepsRepo.createStep({
      funnel_id: funnel.id,
      ...draft,
      step_order: draft.step_order ?? persistedSteps.length + 1,
      step_type: draft.step_type as FunnelStepType,
      status: draft.status ?? "suggested",
      metadata: draft.metadata ?? ({} as Json),
      product_id: draft.product_id ?? null,
      landing_id: draft.landing_id ?? null,
      copy_id: draft.copy_id ?? null,
      creative_id: draft.creative_id ?? null,
      offer_id: draft.offer_id ?? null,
    });
    if (stepError || !step) {
      await funnelsRepo.update(funnel.id, { status: "draft" });
      return { bundle: null, error: stepError ?? "Erro ao salvar etapa do funil." };
    }
    persistedSteps.push(step);
  }

  const expectedAov = calculateExpectedAOV(persistedSteps);
  const expectedConversion = calculateExpectedConversion({
    steps: persistedSteps,
    growthConversionRate: integrationContext.growthConversionRate,
    revenueConversionRate: integrationContext.revenueConversionRate,
  });

  const draftFunnel: Funnel = {
    ...funnel,
    total_steps: persistedSteps.length,
    expected_aov: expectedAov,
    expected_conversion: expectedConversion,
  };
  const map = generateFunnelMap(draftFunnel, persistedSteps);

  const { data: updatedFunnel, error: updateError } = await funnelsRepo.update(funnel.id, {
    status: "ready",
    total_steps: persistedSteps.length,
    expected_aov: expectedAov,
    expected_conversion: expectedConversion,
    metadata: mergeFunnelMetadata(funnel.metadata, {
      funnel_map: map,
      aura_context: buildFunnelEngineAuraContext({
        funnel: draftFunnel,
        steps: persistedSteps,
        map,
      }),
      decision_hints: integrationContext.decisionHints,
    }),
  });

  if (updateError || !updatedFunnel) {
    return { bundle: null, error: updateError ?? "Erro ao finalizar funil." };
  }

  const bundle: FunnelBundle = {
    funnel: updatedFunnel,
    steps: persistedSteps,
    map,
  };

  recordSystemLog({
    tipo: "info",
    modulo: "funnel-engine",
    mensagem: `Funil gerado: ${updatedFunnel.funnel_name}`,
    detalhes: {
      funnelId: updatedFunnel.id,
      productId,
      totalSteps: persistedSteps.length,
      expectedAov,
      expectedConversion,
    },
  });

  void feedIntegrationsFromFunnel(bundle).catch((err) => {
    console.error("[funnel-engine] integration feed failed", err);
  });

  return { bundle, error: null };
}

export async function getFunnelEngineContext(): Promise<{ context: string; error: string | null }> {
  const { bundles, error } = await getFunnelEngineDashboard();
  if (error) return { context: "", error };
  if (!bundles.length) return { context: "Nenhum funil gerado ainda.", error: null };
  return {
    context: bundles
      .slice(0, 3)
      .map((b) => buildFunnelEngineAuraContext(b))
      .join("\n\n---\n\n"),
    error: null,
  };
}

export async function loadFunnelBundleByProductId(
  productId: string
): Promise<{ bundle: FunnelBundle | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const stepsRepo = new FunnelStepsRepository(ctx.supabase, ctx.userId);
  const { data: funnel, error } = await funnelsRepo.findLatestByProductId(productId);
  if (error || !funnel) return { bundle: null, error: error ?? "Funil não encontrado." };

  const { data: steps } = await stepsRepo.findByFunnelId(funnel.id);
  const map = generateFunnelMap(funnel, steps ?? []);
  return { bundle: { funnel, steps: steps ?? [], map }, error: null };
}
