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
import { getMetaIntelligence } from "@/lib/supabase/services/meta-intelligence.service";
import { linkCreativeFactoryAssetToOperation } from "@/lib/supabase/services/operation-center.service";
import type { CreativeAsset, Json, OperationCenter } from "@/types/database";
import { calculateProfit, calculateRoi, calculateRoas } from "@/utils/revenue-ai";
import { resolveOperationProductName } from "@/utils/operation-product";
import {
  buildCreativeFactoryDownloadUrl,
  type CreativeFactoryIntake,
} from "@/utils/creative-factory";
import {
  buildCreativeDirectorDownloadUrl,
  buildCreativePackageManifest,
  buildCreativePackageStoragePath,
  computeHeuristicCreativeScore,
  computeOverallCreativeScore,
  CREATIVE_DIRECTOR_SAFE_MODE,
  CREATIVE_PACKAGE_ASSET_TYPES,
  mergeCreativeDirectorMetadata,
  type CreativePackageAssetEntry,
  type CreativePackageManifest,
  type CreativeScore,
} from "@/utils/creative-director";
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
}): Promise<CreativeScore | null> {
  const openai = getOpenAi();
  if (!openai) return null;

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
        content: `Você é o Creative Director da Aura — avalia pacotes criativos para campanhas Meta.
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
      },
      {
        role: "user",
        content: JSON.stringify({
          headline_copylab: params.copyHeadline,
          meta_rejection_hints: params.metaHints,
          assets: summary,
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

  const estimatedRevenue = params.creativeScore.overall * 10;
  const estimatedSpend = 100;
  const revenue = await registerRevenue({
    operationId: params.operation.id,
    productId: params.operation.product_id,
    platform: "creative_director",
    country: "BR",
    currency: "BRL",
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
    creativeScore: CreativeScore;
    storagePath: string;
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
    generated_at: new Date().toISOString(),
    creative_score: update.creativeScore,
    storage_path: update.storagePath,
    ready: true,
    asset_count: update.assetIds.length,
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
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      package: null,
      operation: null,
      assets: [],
      message: "",
      error: "Usuário não autenticado.",
    };
  }

  if (!getOpenAi()) {
    return {
      package: null,
      operation: null,
      assets: [],
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
      message: "",
      error: "Bucket product-files não configurado no Supabase Storage.",
    };
  }

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findById(operationId);
  if (!operation) {
    return {
      package: null,
      operation: null,
      assets: [],
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
      message: "",
      error: errors[0] ?? "Nenhum ativo foi gerado no pacote.",
    };
  }

  const copyHeadline = await loadCopyHeadlineForOperation(operation);
  const metaHints = await loadMetaRejectionHints();
  const { data: metaData } = await getMetaIntelligence();

  const creativeScore =
    (await evaluateCreativeScoreWithAi({
      assets: readyAssets,
      copyHeadline,
      metaHints,
    })) ??
    computeHeuristicCreativeScore({
      assets: readyAssets,
      copyHeadline,
      metaRejectionHints: metaHints,
    });

  const assetEntries = await buildPackageAssetEntries(readyAssets);
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
    assets: assetEntries,
    integrations,
  });

  const { storagePath, error: uploadError } = await uploadPackageManifest({
    userId: ctx.userId,
    operationId,
    packageId,
    manifest,
  });

  if (uploadError) {
    return {
      package: null,
      operation: null,
      assets: readyAssets,
      message: "",
      error: uploadError,
    };
  }

  const { operation: linkedOp, error: linkError } = await linkCreativeDirectorPackageToOperation(
    operationId,
    {
      packageId,
      assetIds: readyAssets.map((a) => a.id),
      creativeScore,
      storagePath,
    }
  );

  const partialNote =
    errors.length > 0 ? ` (${errors.length} ativo(s) com falha)` : "";
  const message = `Pacote criativo gerado: ${readyAssets.length}/${CREATIVE_PACKAGE_ASSET_TYPES.length} ativos · Score ${creativeScore.overall}/100${partialNote}`;

  return {
    package: manifest,
    operation: linkedOp,
    assets: readyAssets,
    message,
    error: linkError,
  };
}

export async function downloadCreativePackage(operationId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  mimeType: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      buffer: null,
      fileName: "pacote-criativo.json",
      mimeType: "application/json",
      error: "Usuário não autenticado.",
    };
  }

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findById(operationId);
  if (!operation) {
    return {
      buffer: null,
      fileName: "pacote-criativo.json",
      mimeType: "application/json",
      error: "Operação não encontrada.",
    };
  }

  const metadata = operation.metadata as Record<string, unknown> | null;
  const director = metadata?.creative_director as Record<string, unknown> | undefined;
  const storagePath =
    typeof director?.storage_path === "string" ? director.storage_path : null;

  if (storagePath) {
    const { data, error } = await ctx.supabase.storage.from(BUCKET).download(storagePath);
    if (!error && data) {
      const slug = (operation.titulo ?? "operacao")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);

      return {
        buffer: await data.arrayBuffer(),
        fileName: `pacote-criativo-${slug}.json`,
        mimeType: "application/json",
        error: null,
      };
    }
  }

  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const { data: assets } = await repo.findByOperationId(operationId);
  const readyAssets = (assets ?? []).filter((a) => a.status === "ready");

  if (readyAssets.length === 0) {
    return {
      buffer: null,
      fileName: "pacote-criativo.json",
      mimeType: "application/json",
      error: "Nenhum pacote criativo disponível para download.",
    };
  }

  const copyHeadline = await loadCopyHeadlineForOperation(operation);
  const creativeScore = computeHeuristicCreativeScore({ assets: readyAssets, copyHeadline });
  const assetEntries = await buildPackageAssetEntries(readyAssets);

  const manifest = buildCreativePackageManifest({
    packageId: randomUUID(),
    operationId,
    productId: operation.product_id,
    creativeScore,
    assets: assetEntries,
    integrations: {
      copylab: Boolean(operation.copylab_id),
      growth_brain: false,
      revenue_ai: false,
      meta_intelligence: false,
      operation_center: true,
    },
  });

  const content = JSON.stringify(manifest, null, 2);
  const slug = (operation.titulo ?? "operacao")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  return {
    buffer: new TextEncoder().encode(content).buffer,
    fileName: `pacote-criativo-${slug}.json`,
    mimeType: "application/json",
    error: null,
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
