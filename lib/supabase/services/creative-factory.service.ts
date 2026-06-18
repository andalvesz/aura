import OpenAI from "openai";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { linkCreativeFactoryAssetToOperation } from "@/lib/supabase/services/operation-center.service";
import type {
  CreativeAsset,
  CreativeAssetType,
  Json,
  OperationCenter,
  TableInsert,
} from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import {
  buildCreativeFactoryDownloadUrl,
  buildCreativeStoragePath,
  computeCreativeFactoryDashboard,
  CREATIVE_FILES_BUCKET,
  resolveCreativeOutputFormat,
  type CreativeFactoryDashboardMetrics,
  type CreativeFactoryIntake,
  type CreativeMediaProvider,
} from "@/utils/creative-factory";
import { probeStorageBucketWrite } from "@/lib/supabase/storage/bucket-probe";
import { getOptionalDataContext } from "./context";

const BUCKET = CREATIVE_FILES_BUCKET;

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

async function callCreativeFactoryAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

const GENERATION_PROMPTS: Record<
  CreativeAssetType,
  { system: string; fallbackTitle: string }
> = {
  image: {
    fallbackTitle: "Briefing de Imagem",
    system: `Você é a Aura Creative Factory — cria briefings profissionais de imagem para anúncios.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "visual_brief": string,
  "cta": string,
  "dimensions": string
}
Regras:
- prompt: prompt profissional em inglês para gerador de imagem (DALL-E/Midjourney style)
- copy: texto do anúncio em português do Brasil
- format: ex. "1080x1080 feed" ou "1080x1920 stories"
- visual_brief: composição, cores, tipografia, mood
- Nunca prometa resultados garantidos`,
  },
  carousel: {
    fallbackTitle: "Carrossel Instagram",
    system: `Você é a Aura Creative Factory — cria estrutura de carrossel para Instagram.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "slides": [{ "headline": string, "body": string, "visual_note": string }]
}
Regras:
- 5 a 8 slides
- Slide 1: hook magnético
- Último slide: CTA forte
- prompt: resumo visual geral para o carrossel
- Português do Brasil`,
  },
  banner: {
    fallbackTitle: "Banner",
    system: `Você é a Aura Creative Factory — cria briefing de banner para Meta Ads.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "visual_brief": string,
  "cta": string,
  "dimensions": string
}
Regras:
- format: 1200x628 ou 1080x1080
- prompt em inglês para gerador de imagem`,
  },
  thumbnail: {
    fallbackTitle: "Thumbnail",
    system: `Você é a Aura Creative Factory — cria briefing de thumbnail.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "visual_brief": string,
  "cta": string,
  "dimensions": string
}
Regras:
- format: 1280x720 YouTube ou 1080x1920 Reels cover`,
  },
  vsl_script: {
    fallbackTitle: "Roteiro VSL",
    system: `Você é a Aura Creative Factory — roteirista de VSL (Video Sales Letter).
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "hook": string,
  "problem": string,
  "agitation": string,
  "solution": string,
  "proof": string,
  "offer": string,
  "cta": string,
  "full_script": string
}
Regras:
- full_script: roteiro completo 3-8 minutos, falado, com marcações [VISUAL] e [TEXTO NA TELA]
- Português do Brasil, tom persuasivo ético`,
  },
  reel_script: {
    fallbackTitle: "Roteiro Reels",
    system: `Você é a Aura Creative Factory — roteirista de Reels/Shorts.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "hook": string,
  "scenes": [{ "duration_sec": number, "visual": string, "audio": string }],
  "cta": string,
  "full_script": string
}
Regras:
- 30-60 segundos total
- hook nos primeiros 3 segundos
- Português do Brasil`,
  },
  ugc_script: {
    fallbackTitle: "Roteiro UGC",
    system: `Você escreve roteiros UGC autênticos para anúncios de performance.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "hook": string,
  "talking_points": string[],
  "b_roll": string[],
  "cta": string,
  "full_script": string
}
Regras:
- Tom casual, como creator falando para câmera
- 30-45 segundos
- full_script com indicações de tom e gestos`,
  },
  headline_variations: {
    fallbackTitle: "Variações de Headline",
    system: `Você é a Aura Creative Director — cria variações de headline para testes A/B em Meta Ads.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "headlines": [{ "text": string, "angle": string, "hook_type": string }],
  "primary_headline": string,
  "testing_notes": string
}
Regras:
- 5 a 8 headlines distintas
- Ângulos variados: dor, curiosidade, benefício, prova social, urgência
- Português do Brasil
- Nunca prometa resultados garantidos`,
  },
  cta_variations: {
    fallbackTitle: "Variações de CTA",
    system: `Você é a Aura Creative Director — cria variações de CTA para anúncios e landing pages.
Responda APENAS JSON:
{
  "title": string,
  "prompt": string,
  "copy": string,
  "format": string,
  "ctas": [{ "text": string, "context": string, "urgency": string }],
  "primary_cta": string,
  "testing_notes": string
}
Regras:
- 5 a 8 CTAs distintos
- Tom ético, sem pressão abusiva
- Português do Brasil`,
  },
};

function buildFilePayload(
  assetType: CreativeAssetType,
  generated: Record<string, unknown>
): { content: string; mimeType: string; extension: "json" | "txt" } {
  const extension = resolveCreativeOutputFormat(assetType);
  if (extension === "txt") {
    const script =
      typeof generated.full_script === "string"
        ? generated.full_script
        : JSON.stringify(generated, null, 2);
    return { content: script, mimeType: "text/plain; charset=utf-8", extension: "txt" };
  }
  return {
    content: JSON.stringify(generated, null, 2),
    mimeType: "application/json",
    extension: "json",
  };
}

function extractGeneratedFields(
  assetType: CreativeAssetType,
  generated: Record<string, unknown>
): { title: string; prompt: string; copy: string; format: string } {
  const fallback = GENERATION_PROMPTS[assetType].fallbackTitle;
  return {
    title: typeof generated.title === "string" ? generated.title : fallback,
    prompt: typeof generated.prompt === "string" ? generated.prompt : "",
    copy: typeof generated.copy === "string" ? generated.copy : "",
    format: typeof generated.format === "string" ? generated.format : "digital",
  };
}

async function resolveIntakeContext(intake: CreativeFactoryIntake): Promise<{
  bundle: CreatorProductBundle | null;
  copyHeadline: string | null;
}> {
  const { bundles } = await loadCreatorBundles();
  let bundle: CreatorProductBundle | null = null;

  if (intake.product_id) {
    bundle = bundles.find((b) => b.product.id === intake.product_id) ?? null;
  } else if (intake.operation_id) {
    const ctx = await getOptionalDataContext();
    if (ctx) {
      const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
      const { data: operation } = await opRepo.findById(intake.operation_id);
      if (operation?.product_id) {
        bundle = bundles.find((b) => b.product.id === operation.product_id) ?? null;
      }
    }
  }

  let copyHeadline: string | null = intake.headline?.trim() || null;
  if (!copyHeadline && bundle) {
    const { records } = await loadCopylabRecords();
    const copy = records.find((c) => c.product_id === bundle!.product.id);
    copyHeadline = copy?.headline ?? null;
  }

  return { bundle, copyHeadline };
}

function buildUserPrompt(
  intake: CreativeFactoryIntake,
  bundle: CreatorProductBundle | null,
  copyHeadline: string | null
): string {
  return JSON.stringify({
    asset_type: intake.asset_type,
    titulo: intake.titulo ?? bundle?.product.nome ?? "",
    promessa: intake.promessa ?? bundle?.product.promessa ?? "",
    avatar: intake.avatar ?? bundle?.product.avatar ?? "",
    problema: intake.problema ?? bundle?.product.problema ?? "",
    solucao: intake.solucao ?? bundle?.product.solucao ?? "",
    headline: copyHeadline ?? "",
    provider: intake.provider ?? "text-only",
  });
}

export async function checkCreativeFilesBucketReady(): Promise<boolean> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return false;

  const probePath = `creative-assets/${ctx.userId}/creative-factory-healthcheck/probe.txt`;

  return probeStorageBucketWrite({
    supabase: ctx.supabase,
    bucket: BUCKET,
    probePath,
    userId: ctx.userId,
    logPrefix: "[creative-factory]",
  });
}

export async function loadCreativeAssets(): Promise<{
  assets: CreativeAsset[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { assets: [], error: "Usuário não autenticado." };

  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  return { assets: data ?? [], error };
}

export async function getCreativeFactoryDashboard(params?: {
  operationId?: string | null;
}): Promise<{
  dashboard: CreativeFactoryDashboardMetrics | null;
  assets: CreativeAsset[];
  storageReady: boolean;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { dashboard: null, assets: [], storageReady: false, error: "Usuário não autenticado." };
  }

  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const operationId = params?.operationId?.trim();

  const [{ data: allAssets, error }, storageReady] = await Promise.all([
    operationId ? repo.findByOperationId(operationId) : repo.findAllOrdered(),
    checkCreativeFilesBucketReady(),
  ]);

  if (error) {
    return { dashboard: null, assets: [], storageReady, error };
  }

  const assets = allAssets ?? [];
  return {
    dashboard: computeCreativeFactoryDashboard(assets),
    assets,
    storageReady,
    error: null,
  };
}

async function uploadCreativeFile(params: {
  userId: string;
  operationId: string | null;
  assetId: string;
  content: string;
  mimeType: string;
  extension: "json" | "txt";
}): Promise<{ storagePath: string; fileUrl: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { storagePath: "", fileUrl: "", error: "Usuário não autenticado." };
  }

  const storagePath = buildCreativeStoragePath(
    params.userId,
    params.operationId,
    params.assetId,
    params.extension
  );
  const bytes = new TextEncoder().encode(params.content);

  const { error: uploadError } = await ctx.supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: params.mimeType,
    upsert: true,
  });

  if (uploadError) {
    return {
      storagePath: "",
      fileUrl: "",
      error: `Não foi possível salvar o criativo: ${uploadError.message}`,
    };
  }

  const downloadUrl = buildCreativeFactoryDownloadUrl(params.assetId);
  return { storagePath, fileUrl: downloadUrl, error: null };
}

export async function generateCreativeAsset(input: CreativeFactoryIntake): Promise<{
  asset: CreativeAsset | null;
  operation: OperationCenter | null;
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { asset: null, operation: null, message: "", error: "Usuário não autenticado." };
  }
  if (!getOpenAi()) {
    return { asset: null, operation: null, message: "", error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const assetType = input.asset_type;
  if (!GENERATION_PROMPTS[assetType]) {
    return { asset: null, operation: null, message: "", error: "Tipo de criativo inválido." };
  }

  const storageReady = await checkCreativeFilesBucketReady();
  if (!storageReady) {
    return {
      asset: null,
      operation: null,
      message: "",
      error: "Bucket product-files não configurado no Supabase Storage.",
    };
  }

  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const operationId = input.operation_id?.trim() || null;
  const productId = input.product_id?.trim() || null;
  const provider: CreativeMediaProvider = input.provider ?? "text-only";

  const { data: pending, error: createError } = await repo.create({
    operation_id: operationId,
    product_id: productId,
    asset_type: assetType,
    status: "generating",
    metadata: {
      provider,
      safe_mode: true,
      auto_publish: false,
    },
  } satisfies Omit<TableInsert<"creative_assets">, "user_id">);

  if (createError || !pending) {
    return {
      asset: null,
      operation: null,
      message: "",
      error: createError ?? "Erro ao iniciar geração.",
    };
  }

  const { bundle, copyHeadline } = await resolveIntakeContext(input);
  const promptConfig = GENERATION_PROMPTS[assetType];
  const generated = await callCreativeFactoryAi<Record<string, unknown>>(
    promptConfig.system,
    buildUserPrompt(input, bundle, copyHeadline)
  );

  if (!generated) {
    await repo.update(pending.id, { status: "failed" });
    return {
      asset: null,
      operation: null,
      message: "",
      error: "Não foi possível gerar o criativo.",
    };
  }

  const fields = extractGeneratedFields(assetType, generated);
  const { content, mimeType, extension } = buildFilePayload(assetType, generated);

  const { storagePath, fileUrl, error: uploadError } = await uploadCreativeFile({
    userId: ctx.userId,
    operationId,
    assetId: pending.id,
    content,
    mimeType,
    extension,
  });

  if (uploadError) {
    await repo.update(pending.id, { status: "failed", title: fields.title, prompt: fields.prompt });
    return { asset: null, operation: null, message: "", error: uploadError };
  }

  const { data: asset, error: updateError } = await repo.update(pending.id, {
    title: fields.title,
    prompt: fields.prompt,
    copy: fields.copy,
    format: fields.format,
    status: "ready",
    storage_path: storagePath,
    file_url: fileUrl,
    metadata: {
      provider,
      safe_mode: true,
      auto_publish: false,
      generated,
      download_url: fileUrl,
      future_providers: ["openai", "runway", "kling", "veo"],
    } as Json,
  });

  if (updateError || !asset) {
    return {
      asset: null,
      operation: null,
      message: "",
      error: updateError ?? "Erro ao finalizar criativo.",
    };
  }

  let operation: OperationCenter | null = null;
  if (operationId) {
    const sync = await linkCreativeFactoryAssetToOperation(operationId, {
      id: asset.id,
      asset_type: asset.asset_type,
      title: asset.title,
    });
    operation = sync.operation;
  }

  const message = `${fields.title} gerado com sucesso. Arquivo disponível para download.`;

  void import("./excellence-integration.service")
    .then(({ scheduleExcellenceReview }) => {
      scheduleExcellenceReview("creative", asset.id, fields.title, "creative-factory");
    })
    .catch(() => undefined);

  return {
    asset: asset as CreativeAsset,
    operation,
    message,
    error: null,
  };
}

export async function downloadCreativeAsset(assetId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  mimeType: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      buffer: null,
      fileName: "criativo",
      mimeType: "application/octet-stream",
      error: "Usuário não autenticado.",
    };
  }

  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const { data: asset, error: findError } = await repo.findById(assetId);
  if (findError || !asset) {
    return {
      buffer: null,
      fileName: "criativo",
      mimeType: "application/octet-stream",
      error: findError ?? "Criativo não encontrado.",
    };
  }

  if (!asset.storage_path) {
    return {
      buffer: null,
      fileName: "criativo",
      mimeType: "application/octet-stream",
      error: "Arquivo não disponível.",
    };
  }

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const specialistGate = await requireExcellenceDelivery("creative", assetId, {
    module: "creative-factory",
  });
  if (!specialistGate.allowed) {
    return {
      buffer: null,
      fileName: asset.title ?? "criativo",
      mimeType: "application/octet-stream",
      error: specialistGate.error ?? "Download bloqueado pelo Specialist Engine.",
    };
  }

  const { data, error: downloadError } = await ctx.supabase.storage
    .from(BUCKET)
    .download(asset.storage_path);

  if (downloadError || !data) {
    return {
      buffer: null,
      fileName: "criativo",
      mimeType: "application/octet-stream",
      error: downloadError?.message ?? "Erro ao baixar arquivo.",
    };
  }

  const extension = resolveCreativeOutputFormat(asset.asset_type);
  const slug = (asset.title ?? asset.asset_type)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  const mimeType =
    extension === "txt" ? "text/plain; charset=utf-8" : "application/json";

  return {
    buffer: await data.arrayBuffer(),
    fileName: `${slug}.${extension}`,
    mimeType,
    error: null,
  };
}

export async function getCreativeFactoryContext(): Promise<{ context: string; error: string | null }> {
  const { assets, error } = await loadCreativeAssets();
  if (error) return { context: "", error };

  if (assets.length === 0) {
    return { context: "Creative Factory: nenhum criativo gerado ainda.", error: null };
  }

  const summary = assets
    .slice(0, 5)
    .map(
      (a) =>
        `• ${a.title ?? a.asset_type} (${a.status}) — ${a.format ?? "digital"}${a.operation_id ? " [op]" : ""}`
    )
    .join("\n");

  return {
    context: `Creative Factory — ${assets.length} criativo(s):\n${summary}`,
    error: null,
  };
}
