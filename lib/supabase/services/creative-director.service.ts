import OpenAI from "openai";
import { randomUUID } from "crypto";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import {
  checkCreativeFilesBucketReady,
  downloadCreativeAsset,
  generateCreativeAsset,
} from "@/lib/supabase/services/creative-factory.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getMetaIntelligence } from "@/lib/supabase/services/meta-intelligence.service";
import { linkCreativeFactoryAssetToOperation } from "@/lib/supabase/services/operation-center.service";
import type { CreativeAsset, Json, OperationCenter } from "@/types/database";
import { calculateProfit, calculateRoi, calculateRoas } from "@/utils/revenue-ai";
import { resolveCurrencyForMarket } from "@/utils/creator-locale";
import { resolveOperationProductName } from "@/utils/operation-product";
import {
  buildCreativeFactoryDownloadUrl,
  type CreativeFactoryIntake,
} from "@/utils/creative-factory";
import {
  buildCreativeDirectorDownloadUrl,
  buildCreativePackageManifest,
  buildCreativePackageStoragePath,
  computeCreativeQualityScore,
  computeHeuristicCreativeScore,
  computeOverallCreativeScore,
  CREATIVE_DIRECTOR_SAFE_MODE,
  CREATIVE_EXCELLENCE_MAX_CYCLES,
  CREATIVE_EXCELLENCE_MIN,
  CREATIVE_PACKAGE_ASSET_TYPES,
  isCreativeDeliverable,
  mergeCreativeDirectorMetadata,
  readCreativeDirectorMetadata,
  type CreativePackageAssetEntry,
  type CreativePackageManifest,
  type CreativeQualityScore,
  type CreativeScore,
} from "@/utils/creative-director";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import { getWinnerContext } from "./winner-pattern.service";
import {
  augmentGeneratorSystemPrompt,
  buildTransversalGenerationContext,
} from "./expert-brain.service";
import { getOptionalDataContext } from "./context";

const BUCKET = "product-files";

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

async function evaluateCreativeScoreWithAi(params: {
  assets: CreativeAsset[];
  copyHeadline: string | null;
  metaHints: string[];
  niche?: string | null;
  country?: string | null;
}): Promise<CreativeScore | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "creative-director",
    niche: params.niche,
    country: params.country,
  });

  const transversal = await buildTransversalGenerationContext({
    task: "creative_strategy",
    module: "creative-director",
    niche: params.niche,
    winnerPromptBlock: promptBlock,
  });

  const summary = params.assets
    .filter((a) => a.status === "ready")
    .map((a) => ({
      type: a.asset_type,
      title: a.title,
      copy: a.copy?.slice(0, 400),
    }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: augmentGeneratorSystemPrompt(
          `Você é o Creative Director da Aura — avalia pacotes criativos para campanhas Meta.
Responda APENAS JSON:
{
  "clareza": number,
  "promessa": number,
  "curiosidade": number,
  "dor": number,
  "cta": number,
  "risco_reprovacao": number
}
Cada score de 0 a 100. risco_reprovacao: quanto maior, pior (mais chance de reprovação Meta).`,
          "creative-director",
          transversal,
          promptBlock
        ),
      },
      {
        role: "user",
        content: JSON.stringify({
          headline_copylab: params.copyHeadline,
          meta_rejection_hints: params.metaHints,
          assets: summary,
          winnerContext,
          expertContext: transversal.expertContext,
          decisionContext: transversal.decisionContext,
          excellenceCriteria: transversal.excellenceCriteria,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  const parsed = parseJsonBlock<Omit<CreativeScore, "overall">>(content);
  if (!parsed) return null;

  return {
    clareza: Math.round(parsed.clareza ?? 0),
    promessa: Math.round(parsed.promessa ?? 0),
    curiosidade: Math.round(parsed.curiosidade ?? 0),
    dor: Math.round(parsed.dor ?? 0),
    cta: Math.round(parsed.cta ?? 0),
    risco_reprovacao: Math.round(parsed.risco_reprovacao ?? 0),
    overall: computeOverallCreativeScore(parsed),
  };
}

async function loadMetaRejectionHints(): Promise<string[]> {
  try {
    const { data: meta } = await getMetaIntelligence();
    if (!meta?.connected) return [];

    const hints: string[] = [];
    for (const rec of meta.recommendations ?? []) {
      if (rec.actionType === "suggest_pause") {
        hints.push(rec.title ?? rec.summary ?? "Risco Meta detectado");
      }
    }
    for (const insight of meta.insights ?? []) {
      if (insight.severity === "critical" || insight.severity === "warning") {
        hints.push(insight.title ?? insight.summary ?? "Insight crítico Meta");
      }
    }
    return hints.slice(0, 5);
  } catch {
    return [];
  }
}

async function loadCopyHeadlineForOperation(
  operation: OperationCenter
): Promise<string | null> {
  if (!operation.copylab_id) return null;
  const { records } = await loadCopylabRecords();
  const copy = records.find((c) => c.id === operation.copylab_id);
  return copy?.headline ?? null;
}

async function feedCreativeDirectorIntegrations(params: {
  operation: OperationCenter;
  assets: CreativeAsset[];
  creativeScore: CreativeScore;
  copyHeadline: string | null;
  metaConnected: boolean;
}): Promise<CreativePackageManifest["integrations"]> {
  const primaryAsset = params.assets.find((a) => a.status === "ready");
  const integrations: CreativePackageManifest["integrations"] = {
    copylab: Boolean(params.operation.copylab_id),
    growth_brain: false,
    revenue_ai: false,
    meta_intelligence: params.metaConnected,
    operation_center: true,
  };

  const opMeta =
    params.operation.metadata &&
    typeof params.operation.metadata === "object" &&
    !Array.isArray(params.operation.metadata)
      ? (params.operation.metadata as Record<string, unknown>)
      : undefined;
  const productLabel =
    resolveOperationProductName(params.operation, opMeta) ?? params.operation.product_nome;

  if (primaryAsset) {
    const { registerCreativeResult } = await import("./growth-brain.service");
    const gb = await registerCreativeResult({
      operationId: params.operation.id,
      productId: params.operation.product_id,
      copyId: params.operation.copylab_id,
      creativeId: primaryAsset.id,
      sourcePlatform: "creative_factory",
      conversionRate: params.creativeScore.overall / 100,
      metricType: "estimated",
      lesson: `Pacote Creative Director — score ${params.creativeScore.overall}/100`,
      recommendation:
        params.creativeScore.risco_reprovacao > 50
          ? "Revise claims e CTAs antes de subir no Meta."
          : "Pacote pronto para testes A/B na campanha.",
      metadata: {
        source: "creative_director",
        product_label: productLabel,
        creative_score: params.creativeScore,
        asset_count: params.assets.length,
        headline: params.copyHeadline,
      },
    });
    integrations.growth_brain = !gb.error;
  }

  const { registerRevenue } = await import("./revenue-ai.service");
  const { loadCreatorBundles } = await import("./creator.service");
  const { bundles } = await loadCreatorBundles();
  const productBundle = params.operation.product_id
    ? bundles.find((b) => b.product.id === params.operation.product_id)
    : null;
  const marketCurrency = resolveCurrencyForMarket({
    country: productBundle?.product.target_country,
    language: productBundle?.product.target_language,
    currency: productBundle?.product.currency,
  });
  const marketCountry =
    marketCurrency === "USD"
      ? "US"
      : marketCurrency === "BRL"
        ? "BR"
        : productBundle?.product.target_country ?? "US";

  const estimatedRevenue = params.creativeScore.overall * 10;
  const estimatedSpend = 100;
  const revenue = await registerRevenue({
    operationId: params.operation.id,
    productId: params.operation.product_id,
    platform: "creative_director",
    country: marketCountry,
    currency: marketCurrency,
    revenue: estimatedRevenue,
    spend: estimatedSpend,
    roas: calculateRoas(estimatedRevenue, estimatedSpend),
    roi: calculateRoi(calculateProfit(estimatedRevenue, estimatedSpend), estimatedSpend),
    metricType: "estimated",
    metadata: {
      source: "creative_director",
      product_label: productLabel,
      creative_score: params.creativeScore,
    },
  });
  integrations.revenue_ai = !revenue.error;

  return integrations;
}

async function buildPackageAssetEntries(
  assets: CreativeAsset[]
): Promise<CreativePackageAssetEntry[]> {
  const entries: CreativePackageAssetEntry[] = [];

  for (const asset of assets) {
    if (asset.status !== "ready") continue;

    let content: unknown = null;
    const meta = asset.metadata as Record<string, unknown> | null;
    if (meta?.generated) {
      content = meta.generated;
    } else {
      const { buffer, error } = await downloadCreativeAsset(asset.id);
      if (!error && buffer) {
        const text = new TextDecoder().decode(buffer);
        try {
          content = JSON.parse(text);
        } catch {
          content = text;
        }
      }
    }

    entries.push({
      id: asset.id,
      asset_type: asset.asset_type,
      title: asset.title,
      copy: asset.copy,
      format: asset.format,
      download_url: buildCreativeFactoryDownloadUrl(asset.id),
      content,
    });
  }

  return entries;
}

async function uploadPackageManifest(params: {
  userId: string;
  operationId: string;
  packageId: string;
  manifest: CreativePackageManifest;
}): Promise<{ storagePath: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { storagePath: "", error: "Usuário não autenticado." };

  const storagePath = buildCreativePackageStoragePath(
    params.userId,
    params.operationId,
    params.packageId
  );
  const content = JSON.stringify(params.manifest, null, 2);
  const bytes = new TextEncoder().encode(content);

  const { error } = await ctx.supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/json",
    upsert: true,
  });

  if (error) {
    return { storagePath: "", error: `Não foi possível salvar o pacote: ${error.message}` };
  }

  return { storagePath, error: null };
}

export async function linkCreativeDirectorPackageToOperation(
  operationId: string,
  update: {
    packageId: string;
    assetIds: string[];
    generatedAssetIds: string[];
    creativeScore: CreativeScore;
    deliveredCount: number;
  }
): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, error: "Operação não encontrada." };

  const mergedMetadata = mergeCreativeDirectorMetadata(operation.metadata, {
    package_id: update.packageId,
    asset_ids: update.assetIds,
    generated_asset_ids: update.generatedAssetIds,
    generated_at: new Date().toISOString(),
    creative_score: update.creativeScore,
    ready: update.deliveredCount > 0,
    asset_count: update.assetIds.length,
    delivered_count: update.deliveredCount,
  });

  let latestOperation = operation;
  const lastAssetId = update.assetIds[update.assetIds.length - 1];
  if (lastAssetId) {
    const sync = await linkCreativeFactoryAssetToOperation(operationId, {
      id: lastAssetId,
      asset_type: "image",
      title: "Pacote Creative Director",
    });
    if (sync.operation) latestOperation = sync.operation;
  }

  const { data: updated, error } = await repo.update(operationId, {
    metadata: {
      ...(latestOperation.metadata as Record<string, unknown>),
      ...mergedMetadata,
      creative_director_safe_mode: CREATIVE_DIRECTOR_SAFE_MODE.active,
    } as Json,
    status: latestOperation.status === "draft" ? "preparing" : latestOperation.status,
  });

  return { operation: updated, error: error ?? null };
}

export async function generateCreativePackage(operationId: string): Promise<{
  package: CreativePackageManifest | null;
  operation: OperationCenter | null;
  assets: CreativeAsset[];
  generatedAssets: import("@/types/database").CreativeGeneratedAsset[];
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      package: null,
      operation: null,
      assets: [],
      generatedAssets: [],
      message: "",
      error: "Usuário não autenticado.",
    };
  }

  if (!getOpenAi()) {
    return {
      package: null,
      operation: null,
      assets: [],
      generatedAssets: [],
      message: "",
      error: "IA indisponível (OPENAI_API_KEY).",
    };
  }

  const storageReady = await checkCreativeFilesBucketReady();
  if (!storageReady) {
    return {
      package: null,
      operation: null,
      assets: [],
      generatedAssets: [],
      message: "",
      error: "Bucket product-files não configurado no Supabase Storage.",
    };
  }

  const imageProviderAvailable =
    Boolean(process.env.OPENAI_API_KEY?.trim()) || Boolean(process.env.FLUX_API_KEY?.trim());
  if (!imageProviderAvailable) {
    return {
      package: null,
      operation: null,
      assets: [],
      generatedAssets: [],
      message: "",
      error: "Configure OPENAI_API_KEY ou FLUX_API_KEY para gerar imagens reais.",
    };
  }

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findById(operationId);
  if (!operation) {
    return {
      package: null,
      operation: null,
      assets: [],
      generatedAssets: [],
      message: "",
      error: "Operação não encontrada.",
    };
  }

  const packageId = randomUUID();
  const generatedAssets: CreativeAsset[] = [];
  const errors: string[] = [];

  const baseIntake: Omit<CreativeFactoryIntake, "asset_type"> = {
    operation_id: operationId,
    product_id: operation.product_id,
  };

  for (const assetType of CREATIVE_PACKAGE_ASSET_TYPES) {
    const result = await generateCreativeAsset({ ...baseIntake, asset_type: assetType });
    if (result.asset) {
      generatedAssets.push(result.asset);
    }
    if (result.error) {
      errors.push(`${assetType}: ${result.error}`);
    }
  }

  const readyAssets = generatedAssets.filter((a) => a.status === "ready");
  if (readyAssets.length === 0) {
    return {
      package: null,
      operation: null,
      assets: generatedAssets,
      generatedAssets: [],
      message: "",
      error: errors[0] ?? "Nenhum briefing criativo foi gerado.",
    };
  }

  const { generateRealAssetsForCreativeBriefs } = await import(
    "./creative-generated-assets.service"
  );
  const { assets: realAssets, errors: realErrors } = await generateRealAssetsForCreativeBriefs(
    readyAssets
  );
  const deliveredAssets = realAssets.filter((asset) => asset.status === "delivered");

  if (deliveredAssets.length === 0) {
    return {
      package: null,
      operation: null,
      assets: readyAssets,
      generatedAssets: realAssets,
      message: "",
      error:
        realErrors[0] ??
        errors[0] ??
        "Nenhuma imagem real foi entregue. Revise o Excellence Engine ou os providers de imagem.",
    };
  }

  const copyHeadline = await loadCopyHeadlineForOperation(operation);
  const metaHints = await loadMetaRejectionHints();
  const { data: metaData } = await getMetaIntelligence();
  const { bundles } = await loadCreatorBundles();
  const productBundle = bundles.find((b) => b.product.id === operation.product_id);

  const creativeScore =
    (await evaluateCreativeScoreWithAi({
      assets: readyAssets,
      copyHeadline,
      metaHints,
      niche: productBundle?.product.nicho ?? productBundle?.product.publico_alvo,
      country: productBundle?.product.target_country,
    })) ??
    computeHeuristicCreativeScore({
      assets: readyAssets,
      copyHeadline,
      metaRejectionHints: metaHints,
    });

  const creativeQualityScore = computeCreativeQualityScore({
    creativeScore,
    assets: readyAssets,
    copyHeadline,
  });

  const assetEntries = deliveredAssets.map((asset) => {
    const brief = readyAssets.find((item) => item.id === asset.creative_id);
    const assetType = brief?.asset_type ?? "image";
    return {
      id: asset.id,
      asset_type: assetType,
      title:
        ((asset.metadata as Record<string, unknown> | null)?.title as string | null) ??
        brief?.title ??
        null,
      copy: brief?.copy ?? null,
      format: brief?.format ?? "image/png",
      download_url: `/api/creative-director/assets/${asset.id}/download`,
      content: {
        real_asset_id: asset.id,
        thumbnail_url: asset.thumbnail_url,
        preview_url: `/api/creative-director/assets/${asset.id}/preview`,
        provider: asset.provider,
        status: asset.status,
      },
    } satisfies CreativePackageAssetEntry;
  });
  const integrations = await feedCreativeDirectorIntegrations({
    operation,
    assets: readyAssets,
    creativeScore,
    copyHeadline,
    metaConnected: Boolean(metaData?.connected),
  });

  const manifest = buildCreativePackageManifest({
    packageId,
    operationId,
    productId: operation.product_id,
    creativeScore,
    creativeQualityScore,
    assets: assetEntries,
    integrations,
  });

  const { operation: linkedOp, error: linkError } = await linkCreativeDirectorPackageToOperation(
    operationId,
    {
      packageId,
      assetIds: readyAssets.map((a) => a.id),
      generatedAssetIds: deliveredAssets.map((a) => a.id),
      creativeScore,
      deliveredCount: deliveredAssets.length,
    }
  );

  const partialNotes = [
    errors.length > 0 ? `${errors.length} briefing(s) com falha` : null,
    realErrors.length > 0 ? `${realErrors.length} imagem(ns) com falha` : null,
  ].filter(Boolean);
  const partialNote = partialNotes.length > 0 ? ` (${partialNotes.join(" · ")})` : "";
  const message = `Criativos reais entregues: ${deliveredAssets.length}/${CREATIVE_PACKAGE_ASSET_TYPES.length} imagens · Score ${creativeScore.overall}/100${partialNote}`;

  void import("./excellence-integration.service")
    .then(({ scheduleExcellenceReviews }) => {
      scheduleExcellenceReviews(
        deliveredAssets.map((asset) => ({
          assetType: "creative" as const,
          assetId: asset.creative_id ?? asset.id,
          label:
            ((asset.metadata as Record<string, unknown> | null)?.title as string | undefined) ??
            undefined,
        })),
        "creative-director"
      );
    })
    .catch(() => undefined);

  return {
    package: manifest,
    operation: linkedOp,
    assets: readyAssets,
    generatedAssets: deliveredAssets,
    message,
    error: linkError,
  };
}

export async function regenerateCreative(operationId: string): Promise<{
  package: CreativePackageManifest | null;
  creative_quality_score: number;
  cycles: number;
  deliverable: boolean;
  error: string | null;
}> {
  let lastResult: Awaited<ReturnType<typeof generateCreativePackage>> | null = null;
  let cycles = 0;
  let qualityScore = 0;

  for (let cycle = 0; cycle < CREATIVE_EXCELLENCE_MAX_CYCLES; cycle += 1) {
    cycles = cycle + 1;
    lastResult = await generateCreativePackage(operationId);
    if (lastResult.error && !lastResult.package) {
      return {
        package: null,
        creative_quality_score: 0,
        cycles,
        deliverable: false,
        error: lastResult.error,
      };
    }

    const score =
      lastResult.package?.creative_quality_score?.overall ??
      lastResult.package?.creative_score.overall ??
      0;
    qualityScore = score;

    if (isCreativeDeliverable(score)) {
      return {
        package: lastResult.package,
        creative_quality_score: score,
        cycles,
        deliverable: true,
        error: null,
      };
    }

    const { improveAsset } = await import("./excellence-auto-improve.service");
    const primaryAssetId = lastResult.assets[0]?.id;
    if (primaryAssetId) {
      await improveAsset({
        assetType: "creative",
        assetId: primaryAssetId,
        module: "creative-director",
        label: "Creative Excellence Pipeline",
      });
    }
  }

  return {
    package: lastResult?.package ?? null,
    creative_quality_score: qualityScore,
    cycles,
    deliverable: isCreativeDeliverable(qualityScore),
    error: isCreativeDeliverable(qualityScore)
      ? null
      : `creative_quality_score ${qualityScore} abaixo do mínimo ${CREATIVE_EXCELLENCE_MIN} após ${cycles} ciclos.`,
  };
}

export async function downloadCreativePackage(operationId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  mimeType: string;
  downloadUrls: string[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      buffer: null,
      fileName: "criativo.png",
      mimeType: "image/png",
      downloadUrls: [],
      error: "Usuário não autenticado.",
    };
  }

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findById(operationId);
  if (!operation) {
    return {
      buffer: null,
      fileName: "criativo.png",
      mimeType: "image/png",
      downloadUrls: [],
      error: "Operação não encontrada.",
    };
  }

  const director = readCreativeDirectorMetadata(operation.metadata);
  const generatedRepo = new (
    await import("@/lib/supabase/repositories/creative-generated-assets.repository")
  ).CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);

  const generatedIds = director?.generated_asset_ids ?? [];
  const { data: generatedAssets } =
    generatedIds.length > 0
      ? await generatedRepo.findByIds(generatedIds)
      : await generatedRepo.findByOperationId(operationId);

  const deliveredAssets = (generatedAssets ?? []).filter((asset) => asset.status === "delivered");

  if (deliveredAssets.length === 0) {
    return {
      buffer: null,
      fileName: "criativo.png",
      mimeType: "image/png",
      downloadUrls: [],
      error: "Nenhuma imagem real entregue para download.",
    };
  }

  const downloadUrls = deliveredAssets.map(
    (asset) => `/api/creative-director/assets/${asset.id}/download`
  );

  const primary = deliveredAssets[0]!;
  const { downloadRealCreativeAsset } = await import("./creative-generated-assets.service");
  const { buffer, fileName, mimeType, error } = await downloadRealCreativeAsset(primary.id);

  return {
    buffer,
    fileName,
    mimeType,
    downloadUrls,
    error,
  };
}

export async function getCreativeDirectorContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findActive();
  if (!operation) {
    return { context: "Creative Director: nenhuma operação ativa.", error: null };
  }

  const director = (operation.metadata as Record<string, unknown> | null)?.creative_director as
    | Record<string, unknown>
    | undefined;

  if (!director?.ready) {
    return {
      context: "Creative Director: pacote criativo ainda não gerado para a operação ativa.",
      error: null,
    };
  }

  const score = director.creative_score as CreativeScore | undefined;
  const count = director.asset_count ?? director.asset_ids;

  return {
    context: [
      "Creative Director — pacote ativo",
      `Operação: ${operation.titulo}`,
      `Ativos: ${typeof count === "number" ? count : "—"}`,
      score ? `Score: ${score.overall}/100 (risco reprovação: ${score.risco_reprovacao})` : null,
      `Download: ${buildCreativeDirectorDownloadUrl(operation.id)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    error: null,
  };
}
