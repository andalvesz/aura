import OpenAI from "openai";
import {
  ProductComplianceChecksRepository,
  ProductFactoryRepository,
  ProductFilesRepository,
  ProductVersionsRepository,
} from "@/lib/supabase/repositories/product-factory.repository";
import { loadAdsCampaigns } from "@/lib/supabase/services/ads-manager.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { getLaunchDashboard } from "@/lib/supabase/services/launch.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLandingRecords } from "@/lib/supabase/services/landing-builder.service";
import { loadMoneyPlans } from "@/lib/supabase/services/money.service";
import { loadPerformanceInputData } from "@/lib/supabase/services/performance.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type {
  ProductComplianceCheck,
  ProductFactory,
  ProductFactoryType,
  ProductFile,
  ProductVersionLabel,
  TableInsert,
  Json,
} from "@/types/database";
import {
  computeProductFactoryDashboard,
  PRODUCT_FILES_BUCKET,
  STORAGE_BUCKET_WARNING,
  buildProductFactoryDownloadUrl,
  type GeneratedProductFactory,
  type ProductFactoryBundle,
  type ProductFactoryDashboardMetrics,
  type ProductFactoryIntake,
} from "@/utils/product-factory";
import {
  buildProActionPrompt,
  buildProGenerationSystemPrompt,
  computeProductQualityScore,
  detectSensitiveNiche,
  formatProductFactoryOpenAiError,
  mergeQualityIntoContent,
  MAX_AUTO_ELITE_CYCLES,
  normalizeGeneratedCompliance,
  normalizeProGenerated,
  parseProContent,
  productFactoryInvalidAiResponseMessage,
  PRODUCT_MANUAL_REVIEW_MESSAGE,
  PRODUCT_NOT_READY_MESSAGE,
  sanitizeProductFactoryBundle,
  type ProGeneratedProduct,
  type ProductFactoryAiOperation,
  type ProductFactoryProAction,
  type ProductProActionOptions,
} from "@/utils/product-factory-pro";
import {
  acquireProductProLock,
  getActiveProductProLock,
  getProductProDepthForFactory,
  isProductProDepthLimitError,
  isProductProStackOverflowError,
  popProductProDepthForFactory,
  PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE,
  PRODUCT_PRO_LOCK_MESSAGE,
  PRODUCT_PRO_LOOP_DETECTED_MESSAGE,
  pushProductProDepthForFactory,
  recordManualProductProImprove,
  releaseProductProLock,
} from "@/utils/product-pro-locks";
import { probeStorageBucketWrite } from "@/lib/supabase/storage/bucket-probe";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import { getWinnerContext } from "./winner-pattern.service";
import {
  augmentGeneratorSystemPrompt,
  buildTransversalGenerationContext,
} from "./expert-brain.service";
import { getOptionalDataContext } from "./context";

const PDF_BUCKET = PRODUCT_FILES_BUCKET;

export const MAX_PRODUCT_PRO_DEPTH = 5;

function pushProductProDepth(
  source: string,
  factoryId: string,
  action: string
): number {
  const depth = pushProductProDepthForFactory(factoryId);
  console.info("[stack-debug] depth push", {
    depth,
    action,
    factory_id: factoryId,
    source,
  });
  return depth;
}

function popProductProDepth(source: string, factoryId: string, action: string): void {
  console.info("[stack-debug] depth pop", {
    depth: getProductProDepthForFactory(factoryId),
    action,
    factory_id: factoryId,
    source,
  });
  popProductProDepthForFactory(factoryId);
}

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

const PRODUCT_FACTORY_AI_MODEL = "gpt-4o-mini";

type ProductFactoryAiLogContext = {
  action?: string;
  factoryId?: string;
  operation?: ProductFactoryAiOperation;
};

type ProductFactoryAiResult<T> = {
  data: T | null;
  error: string | null;
};

async function callProductFactoryAi<T>(
  system: string,
  user: string,
  logContext?: ProductFactoryAiLogContext
): Promise<ProductFactoryAiResult<T>> {
  const operation = logContext?.operation ?? "generate";
  const openai = getOpenAi();
  if (!openai) {
    console.error("[product-pro] openai unavailable", {
      action: logContext?.action,
      factoryId: logContext?.factoryId,
      operation,
    });
    return { data: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  console.info("[product-pro] openai request", {
    model: PRODUCT_FACTORY_AI_MODEL,
    action: logContext?.action,
    factoryId: logContext?.factoryId,
    operation,
    systemChars: system.length,
    userChars: user.length,
  });

  let response;
  try {
    response = await openai.chat.completions.create({
      model: PRODUCT_FACTORY_AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
  } catch (error) {
    console.error("[product-pro] openai call failed", {
      model: PRODUCT_FACTORY_AI_MODEL,
      action: logContext?.action,
      factoryId: logContext?.factoryId,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      data: null,
      error: formatProductFactoryOpenAiError(error, operation),
    };
  }

  const content = response.choices[0]?.message?.content;
  console.info("[product-pro] openai response", {
    model: PRODUCT_FACTORY_AI_MODEL,
    action: logContext?.action,
    factoryId: logContext?.factoryId,
    operation,
    finishReason: response.choices[0]?.finish_reason,
    contentChars: content?.length ?? 0,
    contentPreview: content?.slice(0, 240) ?? null,
  });

  if (!content) {
    console.error("[product-pro] openai empty content", {
      action: logContext?.action,
      factoryId: logContext?.factoryId,
      operation,
      response: JSON.stringify(response).slice(0, 500),
    });
    return { data: null, error: productFactoryInvalidAiResponseMessage(operation) };
  }

  const parsed = parseJsonBlock<T>(content);
  if (!parsed) {
    console.error("[product-pro] openai parse failed", {
      action: logContext?.action,
      factoryId: logContext?.factoryId,
      operation,
      contentPreview: content.slice(0, 500),
    });
    return { data: null, error: productFactoryInvalidAiResponseMessage(operation) };
  }

  return { data: parsed, error: null };
}

function decodeBase64Pdf(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1]! : base64;
  return new Uint8Array(Buffer.from(raw, "base64"));
}

async function buildIntegrationContext(): Promise<Record<string, unknown>> {
  const [
    { bundles },
    { records: researchRecords },
    { records: copyRecords },
    { records: landingRecords },
    { records: adsRecords },
    { records: studioRecords },
    { plans },
    { input: performanceInput },
    { dashboard: launchDashboard, center: launchCenter },
    { context: legacyContext },
  ] = await Promise.all([
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadLandingRecords(),
    loadAdsCampaigns(),
    loadStudioAssets(),
    loadMoneyPlans(),
    loadPerformanceInputData(),
    getLaunchDashboard(),
    getLegacyContext(),
  ]);

  return {
    creator: bundles.slice(0, 4).map((b) => ({
      nome: b.product.nome,
      problema: b.product.problema,
      solucao: b.product.solucao,
      estagio: b.product.status,
    })),
    research: researchRecords.slice(0, 3).map((r) => ({
      nicho: r.nicho,
      avatar: r.avatar,
      nota: r.nota_final,
      diferencial: r.diferencial_sugerido,
    })),
    copylab: copyRecords.slice(0, 3).map((c) => ({
      nome: c.nome,
      promessa: c.promessa,
      headline: c.headline,
    })),
    launch: launchCenter
      ? {
          produto: launchDashboard?.produtoAtual ?? launchCenter.bundle?.product.nome,
          estagio: launchDashboard?.estagio ?? launchCenter.pipelineStep,
          checklist: launchDashboard?.checklistPercent,
        }
      : null,
    studio: studioRecords.slice(0, 3).map((s) => ({
      nome: s.nome,
      promessa: s.promessa,
      capa: s.capa_ebook ? "sim" : "não",
    })),
    landings: landingRecords.slice(0, 3).map((l) => ({
      nome: l.nome,
      modelo: l.modelo,
      headline: l.headline,
    })),
    ads: adsRecords.slice(0, 3).map((a) => ({
      nome: a.nome,
      campanha: a.campanha_nome,
      status: a.status,
    })),
    money: plans.slice(0, 2).map((p) => ({
      meta: p.valor_meta,
      prazo: p.prazo,
      status: p.status,
    })),
    legado: legacyContext ? legacyContext.slice(0, 500) : null,
    performance: performanceInput
      ? {
          metaProgresso: performanceInput.moneyDashboard.progressoPct,
          adsAtivos: performanceInput.adsDashboard.totalCampanhas,
          creatorProdutos: performanceInput.creatorDashboard.produtosCriados,
        }
      : null,
  };
}

export async function checkProductFilesBucketReady(): Promise<boolean> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return false;

  const probePath = `${ctx.userId}/product-factory-healthcheck/probe.txt`;

  return probeStorageBucketWrite({
    supabase: ctx.supabase,
    bucket: PDF_BUCKET,
    probePath,
    userId: ctx.userId,
    logPrefix: "[product-factory]",
  });
}

async function loadBundleForFactory(factory: ProductFactory): Promise<ProductFactoryBundle> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { factory, files: [], versions: [], compliance: null, latestPdf: null };
  }

  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);

  const [{ data: files }, { data: versions }, { data: compliance }, { data: latestPdf }] =
    await Promise.all([
      filesRepo.findByFactoryId(factory.id),
      versionsRepo.findByFactoryId(factory.id),
      complianceRepo.findLatestByFactoryId(factory.id),
      filesRepo.findLatestPdf(factory.id),
    ]);

  return {
    factory,
    files: files ?? [],
    versions: versions ?? [],
    compliance,
    latestPdf,
  };
}

export async function loadProductFactoryBundles(): Promise<{
  bundles: ProductFactoryBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundles: [], error: "Usuário não autenticado." };

  const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { bundles: [], error };

  const bundles = await Promise.all((data ?? []).map((f) => loadBundleForFactory(f)));
  return { bundles, error: null };
}

export async function getProductFactoryDashboard(): Promise<{
  dashboard: ProductFactoryDashboardMetrics | null;
  bundles: ProductFactoryBundle[];
  storageReady: boolean;
  error: string | null;
}> {
  const { bundles, error } = await loadProductFactoryBundles();
  if (error) return { dashboard: null, bundles: [], storageReady: false, error };
  const storageReady = await checkProductFilesBucketReady();

  return {
    dashboard: computeProductFactoryDashboard(bundles),
    bundles,
    storageReady,
    error: null,
  };
}

export type { ProductFactoryProAction, ProductProActionOptions } from "@/utils/product-factory-pro";

async function persistComplianceFromGenerated(
  complianceRepo: ProductComplianceChecksRepository,
  factoryId: string,
  complianceInput: GeneratedProductFactory["compliance"] | undefined | null,
  previousCompliance?: ProductComplianceCheck | null,
  options?: { sensitiveNiche?: boolean }
) {
  const usedFallback = !complianceInput;
  const compliance = normalizeGeneratedCompliance(
    { compliance: complianceInput ?? undefined },
    previousCompliance,
    options
  );

  if (usedFallback) {
    console.warn("[product-pro] compliance fallback applied", {
      factoryId,
      status: compliance.status,
      riskScore: compliance.risk_score,
    });
  }

  await complianceRepo.create({
    factory_id: factoryId,
    risk_score: compliance.risk_score,
    risk_level: compliance.risk_level,
    forbidden_claims: compliance.forbidden_claims,
    misleading_risks: compliance.misleading_risks,
    ad_checklist: compliance.ad_checklist,
    recommendations: compliance.recommendations,
    status: compliance.status,
    notes: compliance.notes,
  });
}

function buildFactoryPayloadFromPro(
  generated: ProGeneratedProduct,
  input: ProductFactoryIntake,
  productType: ProductFactoryType,
  sensitive: boolean
) {
  const { capitulos, conteudo, design } = normalizeProGenerated(generated, sensitive);
  return {
    product_id: input.product_id ?? null,
    copylab_id: input.copylab_id ?? null,
    research_id: input.research_id ?? null,
    product_type: productType,
    titulo: generated.titulo,
    subtitulo: generated.subtitulo ?? input.subtitulo ?? null,
    promessa: generated.promessa,
    avatar: input.avatar || null,
    publico: generated.publico ?? input.publico ?? null,
    objetivo: generated.objetivo ?? input.objetivo ?? null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    capitulos,
    conteudo,
    exercicios: generated.exercicios ?? [],
    bonus: generated.bonus,
    checklist: generated.checklist ?? [],
    conclusao: generated.conclusao,
    design,
    status: "design_ready" as const,
  };
}

export function evaluateProductQuality(
  factory: ProductFactory,
  compliance?: ProductComplianceCheck | null
) {
  return computeProductQualityScore(factory, compliance ?? null);
}

export async function generateProductFactory(input: ProductFactoryIntake): Promise<{
  bundle: ProductFactoryBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.titulo.trim() && !input.problema.trim()) {
    return { bundle: null, error: "Informe o título ou o problema do produto." };
  }

  const integrations = await buildIntegrationContext();
  const productType: ProductFactoryType = input.product_type ?? "ebook";
  const nicheText = `${input.titulo} ${input.promessa} ${input.problema} ${input.publico ?? ""}`;
  const sensitive = detectSensitiveNiche(nicheText);

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "product-factory",
    niche: input.publico ?? input.promessa,
  });

  const transversal = await buildTransversalGenerationContext({
    task: "product_creation",
    module: "product-factory",
    niche: input.publico ?? input.promessa,
    winnerPromptBlock: promptBlock,
  });

  const { data: generated, error: aiError } = await callProductFactoryAi<ProGeneratedProduct>(
    augmentGeneratorSystemPrompt(
      buildProGenerationSystemPrompt(productType, sensitive),
      "product-factory",
      transversal,
      promptBlock
    ),
    JSON.stringify({
      intake: input,
      product_type: productType,
      integrations,
      pro_v1: true,
      winnerContext,
      expertContext: transversal.expertContext,
      decisionContext: transversal.decisionContext,
      excellenceCriteria: transversal.excellenceCriteria,
    }),
    { operation: "generate" }
  );

  if (aiError) {
    return { bundle: null, error: aiError };
  }

  if (!generated?.titulo || !generated.capitulos?.length) {
    return { bundle: null, error: "Não foi possível gerar o e-book." };
  }

  const normalizedCompliance = normalizeGeneratedCompliance(
    generated,
    null,
    { sensitiveNiche: sensitive }
  );

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const payload = buildFactoryPayloadFromPro(generated, input, productType, sensitive);

  const { data: factory, error: createError } = await factoryRepo.create({
    ...payload,
    conteudo: payload.conteudo as Json,
    current_version: 1,
  } satisfies Omit<TableInsert<"product_factory">, "user_id">);

  if (createError || !factory) {
    return { bundle: null, error: createError ?? "Erro ao salvar produto." };
  }

  await persistComplianceFromGenerated(
    complianceRepo,
    factory.id,
    normalizedCompliance,
    null,
    { sensitiveNiche: sensitive }
  );

  const draftFactory = { ...factory, ...payload, conteudo: payload.conteudo } as ProductFactory;
  const quality = computeProductQualityScore(draftFactory, {
    status: normalizedCompliance.status,
    risk_score: normalizedCompliance.risk_score,
    forbidden_claims: normalizedCompliance.forbidden_claims,
  } as ProductComplianceCheck);
  const enrichedContent = mergeQualityIntoContent(
    payload.conteudo as Record<string, unknown>,
    quality
  );
  await factoryRepo.update(factory.id, { conteudo: enrichedContent as Json });

  await versionsRepo.create({
    factory_id: factory.id,
    version_number: 1,
    version_label: "rascunho",
    snapshot: {
      titulo: generated.titulo,
      promessa: generated.promessa,
      capitulos: payload.capitulos,
      design: payload.design,
      quality_score: quality.score,
    },
    changelog: "v1 — Rascunho Pro V1 gerado pela Aura Product Factory",
    file_id: null,
  });

  const { data: refreshed } = await factoryRepo.findById(factory.id);
  let bundle = refreshed
    ? await loadBundleForFactory(refreshed as ProductFactory)
    : await loadBundleForFactory(draftFactory);

  const initialQuality = computeProductQualityScore(bundle.factory, bundle.compliance);
  if (!initialQuality.readyToSell) {
    const eliteResult = await autoImproveToElite(ctx, factory.id, bundle);
    bundle = eliteResult.bundle;
    if (eliteResult.error) {
      return { bundle, error: eliteResult.error };
    }
  } else {
    await factoryRepo.update(factory.id, {
      status: "content_ready",
      conteudo: mergeQualityIntoContent(
        (bundle.factory.conteudo as Record<string, unknown>) ?? {},
        initialQuality
      ) as Json,
    });
    const { data: eliteReady } = await factoryRepo.findById(factory.id);
    if (eliteReady) bundle = await loadBundleForFactory(eliteReady as ProductFactory);
  }

  const finalQuality = computeProductQualityScore(bundle.factory, bundle.compliance);
  const productId = bundle.factory.product_id ?? input.product_id ?? factory.product_id;
  if (productId && finalQuality.readyToSell) {
    void import("./checkout-engine.service")
      .then((mod) => mod.createCheckout({ productId }))
      .catch((err) => console.error("[checkout-engine] auto-create failed", err));

    void import("./funnel-engine.service")
      .then((mod) =>
        mod.generateFunnel({
          product_id: productId,
          copylab_id: input.copylab_id ?? bundle.factory.copylab_id ?? null,
          factory_id: bundle.factory.id,
          funnel_name: bundle.factory.titulo ?? input.titulo,
          niche: input.publico ?? input.avatar,
        })
      )
      .catch((err) => console.error("[funnel-engine] auto-generate failed", err));
  }

  if (finalQuality.readyToSell) {
    void import("./excellence-integration.service")
      .then(({ scheduleExcellenceReview }) => {
        scheduleExcellenceReview(
          "ebook",
          bundle.factory.id,
          bundle.factory.titulo ?? input.titulo,
          "product-factory"
        );
      })
      .catch(() => undefined);
  }

  return { bundle, error: null };
}

type ProActionOverrides = {
  changelog?: string;
  versionLabel?: ProductVersionLabel;
};

async function executeProductFactoryProActionInternal(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>,
  factoryId: string,
  action: ProductFactoryProAction,
  overrides?: ProActionOverrides,
  source = "executeProductFactoryProActionInternal"
): Promise<{ bundle: ProductFactoryBundle | null; error: string | null }> {
  const depth = pushProductProDepth(source, factoryId, action);
  console.info("[stack-debug] enter executeProductFactoryProActionInternal", {
    depth,
    action,
    factory_id: factoryId,
    source,
  });

  try {
  console.info("[product-pro] execute start", {
    action,
    factoryId,
    userId: ctx.userId,
    depth,
  });

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    console.error("[product-pro] factory not found", { factoryId, findError });
    return { bundle: null, error: findError ?? "Produto não encontrado." };
  }

  const record = factory as ProductFactory;
  const previewBundle = await loadBundleForFactory(record);
  const scoreBefore = computeProductQualityScore(record, previewBundle.compliance).score;

  console.info("[product-pro] factory loaded", {
    action,
    factoryId,
    bundleId: previewBundle.factory.id,
    scoreBefore,
    currentVersion: record.current_version,
    titulo: record.titulo,
  });

  const nicheText = `${record.titulo} ${record.promessa} ${record.problema} ${record.publico ?? ""}`;
  const sensitive =
    detectSensitiveNiche(nicheText) || !!parseProContent(record.conteudo).sensitive_niche;

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "product-factory",
    niche: record.publico ?? record.promessa,
  });

  const transversal = await buildTransversalGenerationContext({
    task: "product_creation",
    module: "product-factory",
    niche: record.publico ?? record.promessa,
    winnerPromptBlock: promptBlock,
  });

  const { data: generated, error: aiError } = await callProductFactoryAi<ProGeneratedProduct>(
    augmentGeneratorSystemPrompt(
      buildProGenerationSystemPrompt(record.product_type ?? "ebook", sensitive),
      "product-factory",
      transversal,
      promptBlock
    ),
    `${buildProActionPrompt(action, record)}\n${JSON.stringify({
      winnerContext,
      expertContext: transversal.expertContext,
      decisionContext: transversal.decisionContext,
      excellenceCriteria: transversal.excellenceCriteria,
    })}`,
    { action, factoryId, operation: "improve" }
  );

  if (aiError) {
    return { bundle: null, error: aiError };
  }

  if (!generated?.titulo || !generated.capitulos?.length) {
    console.error("[product-pro] invalid ai payload", {
      action,
      factoryId,
      hasTitulo: !!generated?.titulo,
      capitulosCount: generated?.capitulos?.length ?? 0,
      generatedKeys: generated ? Object.keys(generated) : null,
    });
    return { bundle: null, error: productFactoryInvalidAiResponseMessage("improve") };
  }

  const intake: ProductFactoryIntake = {
    titulo: record.titulo ?? "",
    subtitulo: record.subtitulo ?? "",
    promessa: record.promessa ?? "",
    avatar: record.avatar ?? "",
    publico: record.publico ?? "",
    objetivo: record.objetivo ?? "",
    problema: record.problema ?? "",
    solucao: record.solucao ?? "",
    product_type: record.product_type ?? "ebook",
    product_id: record.product_id,
    copylab_id: record.copylab_id,
    research_id: record.research_id,
  };

  const payload = buildFactoryPayloadFromPro(
    generated,
    intake,
    record.product_type ?? "ebook",
    sensitive
  );

  const nextVersion = record.current_version + 1;
  const quality = computeProductQualityScore(
    { ...record, ...payload, conteudo: payload.conteudo } as ProductFactory,
    previewBundle.compliance
  );
  const enrichedContent = mergeQualityIntoContent(
    payload.conteudo as Record<string, unknown>,
    quality
  );

  const versionLabel =
    overrides?.versionLabel ??
    (nextVersion >= 3 ? "final" : nextVersion === 2 ? "revisado" : "rascunho");

  const { error: updateError } = await factoryRepo.update(factoryId, {
    ...payload,
    conteudo: enrichedContent as Json,
    current_version: nextVersion,
    status: quality.readyToSell ? "content_ready" : "design_ready",
  });

  if (updateError) {
    console.error("[product-pro] factory update failed", {
      action,
      factoryId,
      updateError,
    });
    return { bundle: null, error: updateError };
  }

  if (action === "improve" || action === "premium" || action === "expand_content") {
    console.info("[product-pro] persist compliance", {
      action,
      factoryId,
      hasCompliance: !!generated.compliance,
      complianceStatus: generated.compliance?.status,
    });
    await persistComplianceFromGenerated(
      complianceRepo,
      factoryId,
      generated.compliance,
      previewBundle.compliance,
      { sensitiveNiche: sensitive }
    );
  }

  const actionLabels: Record<ProductFactoryProAction, string> = {
    improve: "Melhorar Produto",
    regenerate_design: "Regenerar Design",
    expand_content: "Expandir Conteúdo",
    premium: "Versão Premium",
  };

  await versionsRepo.create({
    factory_id: factoryId,
    version_number: nextVersion,
    version_label: versionLabel,
    snapshot: {
      titulo: generated.titulo,
      promessa: generated.promessa,
      capitulos: payload.capitulos,
      design: payload.design,
      quality_score: quality.score,
      action,
    },
    changelog:
      overrides?.changelog ??
      `v${nextVersion} — ${actionLabels[action]} · score ${quality.score}`,
    file_id: null,
  });

  const { data: refreshed } = await factoryRepo.findById(factoryId);
  if (!refreshed) {
    console.error("[product-pro] reload failed", { action, factoryId });
    return { bundle: null, error: "Erro ao recarregar produto." };
  }

  const finalBundle = await loadBundleForFactory(refreshed as ProductFactory);
  const scoreAfter = computeProductQualityScore(
    finalBundle.factory,
    finalBundle.compliance
  ).score;

  console.info("[product-pro] execute complete", {
    action,
    factoryId,
    bundleId: finalBundle.factory.id,
    scoreBefore,
    scoreAfter,
    nextVersion,
    readyToSell: quality.readyToSell,
    depth,
  });

  return { bundle: sanitizeProductFactoryBundle(finalBundle), error: null };
  } finally {
    console.info("[stack-debug] exit executeProductFactoryProActionInternal", {
      depth,
      action,
      factory_id: factoryId,
      source,
    });
    popProductProDepth(source, factoryId, action);
  }
}

const AUTO_ELITE_CYCLES: Array<{
  action: ProductFactoryProAction;
  changelog: string;
  versionLabel: ProductVersionLabel;
}> = [
  {
    action: "improve",
    changelog: "v2 — Melhoria automática Elite",
    versionLabel: "revisado",
  },
  {
    action: "expand_content",
    changelog: "v3 — Expansão automática Elite",
    versionLabel: "revisado",
  },
  {
    action: "premium",
    changelog: "v4 — Premium automático Elite",
    versionLabel: "final",
  },
];

async function autoImproveToElite(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>,
  factoryId: string,
  initialBundle: ProductFactoryBundle
): Promise<{ bundle: ProductFactoryBundle; error: string | null }> {
  console.info("[stack-debug] enter autoImproveToElite", { factory_id: factoryId });

  const lockAcquired = acquireProductProLock(factoryId, "auto_elite", "auto_elite");
  if (!lockAcquired) {
    return { bundle: initialBundle, error: PRODUCT_PRO_LOCK_MESSAGE };
  }

  let bundle = initialBundle;

  try {
    const cycles = AUTO_ELITE_CYCLES.slice(0, MAX_AUTO_ELITE_CYCLES);

    for (let cycleIndex = 0; cycleIndex < cycles.length; cycleIndex += 1) {
      const cycle = cycles[cycleIndex];
      const quality = computeProductQualityScore(bundle.factory, bundle.compliance);
      console.info("[product-pro-trace] AUTO_ELITE", {
        factoryId,
        cycle: cycleIndex + 1,
        action: cycle.action,
      });
      console.info("[stack-debug] autoImproveToElite cycle", {
        factory_id: factoryId,
        action: cycle.action,
        readyToSell: quality.readyToSell,
        score: quality.score,
      });
      if (quality.readyToSell) break;

      const { bundle: improved, error } = await executeProductFactoryProActionInternal(
        ctx,
        factoryId,
        cycle.action,
        { changelog: cycle.changelog, versionLabel: cycle.versionLabel },
        "auto_elite"
      );

      if (error || !improved) {
        console.warn("[product-factory] auto-improve cycle failed", {
          factoryId,
          action: cycle.action,
          error,
        });
        break;
      }
      bundle = improved;
    }

    const finalQuality = computeProductQualityScore(bundle.factory, bundle.compliance);
    console.info("[stack-debug] exit autoImproveToElite", {
      factory_id: factoryId,
      readyToSell: finalQuality.readyToSell,
      score: finalQuality.score,
    });
    if (!finalQuality.readyToSell) {
      return { bundle, error: PRODUCT_MANUAL_REVIEW_MESSAGE };
    }

    return { bundle, error: null };
  } catch (error) {
    if (isProductProDepthLimitError(error)) {
      console.error("[product-pro-trace] LOOP_BLOCKED", {
        factoryId,
        context: "autoImproveToElite",
        reason: "depth_limit",
        depth: error.depth,
      });
      return { bundle, error: PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE };
    }
    if (isProductProStackOverflowError(error)) {
      console.error("[product-pro-trace] LOOP_BLOCKED", {
        factoryId,
        context: "autoImproveToElite",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { bundle, error: PRODUCT_PRO_LOOP_DETECTED_MESSAGE };
    }
    throw error;
  } finally {
    releaseProductProLock(factoryId);
  }
}

export async function runProductFactoryProAction(
  factoryId: string,
  action: ProductFactoryProAction,
  options?: ProductProActionOptions
): Promise<{ bundle: ProductFactoryBundle | null; error: string | null }> {
  const source = options?.source ?? "manual";

  console.info("[product-pro-trace] START", {
    source,
    action,
    factoryId,
    stack: new Error().stack,
  });

  console.info("[stack-debug] enter runProductFactoryProAction", {
    action,
    factory_id: factoryId,
    source,
  });
  console.info("[product-pro] runProductFactoryProAction", { action, factoryId, source });

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    console.error("[product-pro] no auth context", { action, factoryId });
    console.info("[stack-debug] exit runProductFactoryProAction", {
      action,
      factory_id: factoryId,
      reason: "no-auth",
    });
    return { bundle: null, error: "Usuário não autenticado." };
  }
  if (!getOpenAi()) {
    console.error("[product-pro] openai key missing", { action, factoryId });
    console.info("[stack-debug] exit runProductFactoryProAction", {
      action,
      factory_id: factoryId,
      reason: "no-openai",
    });
    return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const lockAcquired = acquireProductProLock(factoryId, action, source);
  if (!lockAcquired) {
    const activeLock = getActiveProductProLock(factoryId);
    console.error("[product-pro-trace] LOCK_BLOCKED", {
      factoryId,
      action,
      source,
      activeLock,
      stack: new Error().stack,
    });
    console.info("[product-pro] action blocked by active lock", { factoryId, action, source });
    return { bundle: null, error: PRODUCT_PRO_LOCK_MESSAGE };
  }

  let response: { bundle: ProductFactoryBundle | null; error: string | null };

  try {
    const result = await executeProductFactoryProActionInternal(
      ctx,
      factoryId,
      action,
      undefined,
      source
    );

    if (source === "manual" && !result.error && result.bundle) {
      recordManualProductProImprove(factoryId);
    }

    response = {
      bundle: sanitizeProductFactoryBundle(result.bundle),
      error: result.error,
    };
  } catch (error) {
    if (isProductProDepthLimitError(error)) {
      console.error("[product-pro-trace] LOOP_BLOCKED", {
        factoryId,
        action,
        source,
        reason: "depth_limit",
        depth: error.depth,
      });
      response = { bundle: null, error: PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE };
    } else if (isProductProStackOverflowError(error)) {
      console.error("[product-pro-trace] LOOP_BLOCKED", {
        factoryId,
        action,
        source,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error("[product-pro] stack overflow blocked", { action, factoryId, source });
      response = { bundle: null, error: PRODUCT_PRO_LOOP_DETECTED_MESSAGE };
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[product-pro] unhandled error", {
        action,
        factoryId,
        source,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error("[stack-debug] runProductFactoryProAction error", {
        action,
        factory_id: factoryId,
        source,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      response = { bundle: null, error: message };
    }
  } finally {
    releaseProductProLock(factoryId);
    console.info("[stack-debug] exit runProductFactoryProAction", {
      action,
      factory_id: factoryId,
      source,
    });
  }

  return response;
}

export async function publishProductFactoryPdf(input: {
  factory_id: string;
  pdf_base64: string;
  premium?: boolean;
}): Promise<{
  file: ProductFile | null;
  bundle: ProductFactoryBundle | null;
  error: string | null;
  qualityScore?: number;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { file: null, bundle: null, error: "Usuário não autenticado." };

  const factoryId = input.factory_id.trim();
  const pdfBase64 = input.pdf_base64.trim();
  if (!factoryId || !pdfBase64) {
    return { file: null, bundle: null, error: "factory_id e pdf_base64 são obrigatórios." };
  }

  const pdfBytes = decodeBase64Pdf(pdfBase64);
  if (pdfBytes.length < 100) {
    return { file: null, bundle: null, error: "PDF inválido." };
  }

  console.info("[ebook] pdf generated", {
    factoryId,
    sizeBytes: pdfBytes.length,
  });

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { file: null, bundle: null, error: findError ?? "Produto não encontrado." };
  }

  const bundlePreview = await loadBundleForFactory(factory as ProductFactory);
  const quality = computeProductQualityScore(factory as ProductFactory, bundlePreview.compliance);

  if (!quality.readyToSell) {
    console.warn("[product-factory] publish blocked by quality score", {
      factoryId,
      score: quality.score,
      issues: quality.issues,
    });
    return {
      file: null,
      bundle: bundlePreview,
      error: PRODUCT_NOT_READY_MESSAGE,
      qualityScore: quality.score,
    };
  }

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const specialistGate = await requireExcellenceDelivery("ebook", factoryId, {
    module: "product-factory",
  });
  if (!specialistGate.allowed) {
    return {
      file: null,
      bundle: bundlePreview,
      error: specialistGate.error ?? "E-book bloqueado pelo Specialist Engine.",
      qualityScore: specialistGate.result?.finalScore ?? quality.score,
    };
  }

  const storageReady = await checkProductFilesBucketReady();
  if (!storageReady) {
    return { file: null, bundle: null, error: STORAGE_BUCKET_WARNING };
  }

  const nextVersion = Math.max(factory.current_version + 1, 3);
  const versionLabel: ProductVersionLabel = "final";
  const slug = (factory.titulo ?? "ebook")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  const premiumSuffix = input.premium ? "-premium" : "";
  const storagePath = `${ctx.userId}/${factoryId}/${slug}-v${nextVersion}${premiumSuffix}.pdf`;
  const fileName = `${slug}-v${nextVersion}${premiumSuffix}.pdf`;

  const { error: uploadError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[ebook] upload failed", {
      factoryId,
      bucket: PDF_BUCKET,
      storagePath,
      error: uploadError.message,
    });
    return {
      file: null,
      bundle: null,
      error: `Não foi possível salvar o PDF: ${uploadError.message}`,
    };
  }

  console.info("[ebook] uploaded", {
    factoryId,
    bucket: PDF_BUCKET,
    storagePath,
    sizeBytes: pdfBytes.length,
  });

  const { data: verifyDownload, error: verifyError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .download(storagePath);

  if (verifyError || !verifyDownload) {
    console.error("[ebook] storage verify failed", {
      factoryId,
      storagePath,
      error: verifyError?.message,
    });
    return {
      file: null,
      bundle: null,
      error: "PDF enviado, mas não foi encontrado no Storage.",
    };
  }

  const { data: publicData } = ctx.supabase.storage.from(PDF_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;

  const { data: signedData, error: signedError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, 3600);

  console.info("[ebook] public url", {
    factoryId,
    storagePath,
    publicUrl,
    signedUrl: signedData?.signedUrl ?? null,
    signedError: signedError?.message ?? null,
  });

  const { data: file, error: fileError } = await filesRepo.create({
    factory_id: factoryId,
    file_type: "pdf",
    storage_path: storagePath,
    file_url: publicUrl,
    file_name: fileName,
    mime_type: "application/pdf",
    size_bytes: pdfBytes.length,
    version_number: nextVersion,
  } satisfies Omit<TableInsert<"product_files">, "user_id">);

  if (fileError || !file) {
    return { file: null, bundle: null, error: fileError ?? "Erro ao registrar arquivo." };
  }

  const downloadUrl = buildProductFactoryDownloadUrl(file.id);
  const { data: updatedFile, error: urlUpdateError } = await filesRepo.update(file.id, {
    file_url: downloadUrl,
  });

  if (urlUpdateError) {
    console.warn("[ebook] download url update failed", {
      fileId: file.id,
      downloadUrl,
      error: urlUpdateError,
    });
  }

  const persistedFile = (updatedFile as ProductFile | null) ?? (file as ProductFile);

  await factoryRepo.update(factoryId, {
    current_version: nextVersion,
    status: "pdf_ready",
    conteudo: mergeQualityIntoContent(
      (factory.conteudo as Record<string, unknown>) ?? {},
      quality
    ) as Json,
  });

  await versionsRepo.create({
    factory_id: factoryId,
    version_number: nextVersion,
    version_label: versionLabel,
    snapshot: {
      titulo: factory.titulo,
      promessa: factory.promessa,
      capitulos: factory.capitulos,
      design: factory.design,
    },
    changelog: `v${nextVersion} — Final · PDF publicado`,
    file_id: persistedFile.id,
  });

  const { data: updatedFactory } = await factoryRepo.findById(factoryId);
  const bundle = updatedFactory
    ? await loadBundleForFactory(updatedFactory as ProductFactory)
    : null;

  return { file: persistedFile, bundle, error: null, qualityScore: quality.score };
}

export async function downloadProductFactoryPdf(fileId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { buffer: null, fileName: "ebook.pdf", error: "Usuário não autenticado." };

  const trimmedId = fileId.trim();
  if (!trimmedId) {
    return { buffer: null, fileName: "ebook.pdf", error: "ID do arquivo inválido." };
  }

  console.info("[ebook] download requested", { fileId: trimmedId, userId: ctx.userId });

  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const { data: file, error: findError } = await filesRepo.findById(trimmedId);

  if (findError || !file) {
    console.warn("[ebook] download file not found", {
      fileId: trimmedId,
      error: findError,
    });
    return { buffer: null, fileName: "ebook.pdf", error: findError ?? "Arquivo não encontrado." };
  }

  const record = file as ProductFile;
  if (!record.storage_path?.trim()) {
    return { buffer: null, fileName: record.file_name ?? "ebook.pdf", error: "Caminho do PDF ausente." };
  }

  console.info("[ebook] download resolved", {
    fileId: record.id,
    factoryId: record.factory_id,
    storagePath: record.storage_path,
    bucket: PDF_BUCKET,
  });

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const excellenceGate = await requireExcellenceDelivery("ebook", record.factory_id, {
    module: "product-factory",
  });
  if (!excellenceGate.allowed) {
    return {
      buffer: null,
      fileName: record.file_name ?? "ebook.pdf",
      error: excellenceGate.error ?? "Download bloqueado pelo Aura Excellence Engine.",
    };
  }

  const { data: blob, error: downloadError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .download(record.storage_path);

  if (downloadError || !blob) {
    console.error("[ebook] download storage failed", {
      fileId: record.id,
      storagePath: record.storage_path,
      error: downloadError?.message,
    });
    return {
      buffer: null,
      fileName: record.file_name ?? "ebook.pdf",
      error: downloadError?.message ?? "Arquivo PDF não encontrado no Storage.",
    };
  }

  return {
    buffer: await blob.arrayBuffer(),
    fileName: record.file_name ?? "ebook.pdf",
    error: null,
  };
}

export async function runProductFactoryCompliance(factoryId: string): Promise<{
  compliance: ProductComplianceCheck | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { compliance: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { compliance: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { compliance: null, error: findError ?? "Produto não encontrado." };
  }

  const { data: generated, error: aiError } = await callProductFactoryAi<
    GeneratedProductFactory["compliance"]
  >(
    `Você é auditor de compliance para anúncios de produtos digitais no Brasil (Meta, Google, CONAR).
Analise promessa e conteúdo. Responda APENAS JSON com campos compliance:
{
  "risk_score": number,
  "risk_level": "low" | "medium" | "high",
  "forbidden_claims": string[],
  "misleading_risks": string[],
  "ad_checklist": [{ "item": string, "status": "ok" | "atencao" | "bloqueado", "nota": string }],
  "recommendations": string[],
  "status": "pass" | "warning" | "fail",
  "notes": string
}`,
    JSON.stringify({
      titulo: factory.titulo,
      promessa: factory.promessa,
      capitulos: factory.capitulos,
      bonus: factory.bonus,
    }),
    { factoryId, operation: "compliance" }
  );

  if (aiError) {
    return { compliance: null, error: aiError };
  }

  if (!generated) {
    return { compliance: null, error: "Não foi possível analisar compliance." };
  }

  const compliancePayload = normalizeGeneratedCompliance(
    { compliance: generated },
    null
  );

  const { data: compliance, error: createError } = await complianceRepo.create({
    factory_id: factoryId,
    risk_score: compliancePayload.risk_score,
    risk_level: compliancePayload.risk_level,
    forbidden_claims: compliancePayload.forbidden_claims,
    misleading_risks: compliancePayload.misleading_risks,
    ad_checklist: compliancePayload.ad_checklist,
    recommendations: compliancePayload.recommendations,
    status: compliancePayload.status,
    notes: compliancePayload.notes,
  });

  if (createError || !compliance) {
    return { compliance: null, error: createError ?? "Erro ao salvar compliance." };
  }

  if (factory.current_version < 2) {
    await factoryRepo.update(factoryId, { current_version: 2, status: "content_ready" });
    await versionsRepo.create({
      factory_id: factoryId,
      version_number: 2,
      version_label: "revisado",
      snapshot: {
        titulo: factory.titulo,
        promessa: factory.promessa,
        capitulos: factory.capitulos,
        compliance: compliancePayload,
      },
      changelog: "v2 — Revisado · compliance atualizado",
      file_id: null,
    });
  }

  return { compliance: compliance as ProductComplianceCheck, error: null };
}

export async function deleteProductFactoryRecord(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}

export async function getProductFactoryContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ bundles }, integrations] = await Promise.all([
    loadProductFactoryBundles(),
    buildIntegrationContext(),
  ]);

  const summary =
    bundles.length > 0
      ? bundles
          .slice(0, 4)
          .map(
            (b) =>
              `• ${b.factory.titulo ?? "Produto"} — ${b.factory.status} · PDF: ${b.latestPdf ? "sim" : "não"} · compliance: ${b.compliance?.status ?? "—"}`
          )
          .join("\n")
      : "Nenhum produto na Product Factory.";

  return {
    context: `## AURA PRODUCT FACTORY\n${summary}\n\n## INTEGRAÇÕES\n${JSON.stringify(integrations, null, 2)}`,
    error: null,
  };
}
