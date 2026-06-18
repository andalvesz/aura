import OpenAI from "openai";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { CreativeGeneratedAssetsRepository } from "@/lib/supabase/repositories/creative-generated-assets.repository";
import { checkCreativeFilesBucketReady } from "@/lib/supabase/services/creative-factory.service";
import {
  generateRealMedia,
  isImageProviderAvailable,
} from "@/lib/supabase/services/creative-media.service";
import type {
  CreativeAsset,
  CreativeGeneratedAsset,
  CreativeGeneratedAssetType,
  CreativeMediaProviderId,
  Json,
  TableInsert,
} from "@/types/database";
import {
  buildCreativeGeneratedDownloadUrl,
  buildCreativeGeneratedPreviewUrl,
  buildCreativeGeneratedStoragePath,
  computeCreativeDirectorRealDashboard,
  type CreativeDirectorRealDashboard,
  type CreativeGeneratedAssetIntake,
} from "@/utils/creative-generated-assets";
import {
  mapCreativeAssetToGeneratedType,
  PreparedVideoProviderError,
  resolveDefaultImageProvider,
  resolveMediaDimensions,
} from "@/utils/creative-media-providers";
import { CREATIVE_FILES_BUCKET } from "@/utils/creative-factory";
import { getOptionalDataContext } from "./context";

const BUCKET = CREATIVE_FILES_BUCKET;

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function optimizePromptForRealAsset(params: {
  assetType: CreativeGeneratedAssetType;
  basePrompt: string;
  copy?: string | null;
  title?: string | null;
}): Promise<string> {
  const openai = getOpenAi();
  const dimensions = resolveMediaDimensions(params.assetType);

  if (!openai) {
    return params.basePrompt.trim() || "Professional ad creative, high quality, clean composition";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é o Creative Director da Aura — otimiza prompts para geradores de imagem (DALL-E / Flux).
Responda APENAS JSON: { "prompt": string }
Regras:
- Prompt final em inglês, detalhado, sem texto ilegível na imagem
- Formato: ${dimensions.label}
- Estilo profissional para Meta Ads
- Sem promessas médicas/financeiras enganosas
- Sem logos de marcas reais`,
      },
      {
        role: "user",
        content: JSON.stringify({
          asset_type: params.assetType,
          base_prompt: params.basePrompt,
          ad_copy: params.copy ?? "",
          title: params.title ?? "",
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return params.basePrompt.trim();

  try {
    const parsed = JSON.parse(content) as { prompt?: string };
    return typeof parsed.prompt === "string" && parsed.prompt.trim()
      ? parsed.prompt.trim()
      : params.basePrompt.trim();
  } catch {
    return params.basePrompt.trim();
  }
}

async function reviewPromptWithExcellence(params: {
  creativeId: string | null;
  optimizedPrompt: string;
  copy?: string | null;
  title?: string | null;
  module: string;
}): Promise<{ approved: boolean; score: number | null; error: string | null }> {
  const reviewContent = [
    `Título: ${params.title ?? "—"}`,
    `Copy: ${params.copy ?? "—"}`,
    `Prompt otimizado para geração de imagem:`,
    params.optimizedPrompt,
  ].join("\n");

  const assetId = params.creativeId ?? "prompt-review";
  const { runExcellencePipeline } = await import("./excellence-integration.service");

  const pipeline = await runExcellencePipeline({
    assetType: "creative",
    assetId,
    label: params.title ?? "Creative Real Asset",
    content: reviewContent,
    module: params.module,
    forceRefresh: true,
  });

  if (pipeline.error) {
    return { approved: false, score: pipeline.score?.final_score ?? null, error: pipeline.error };
  }

  if (!pipeline.deliverable) {
    return {
      approved: false,
      score: pipeline.score?.final_score ?? pipeline.result?.finalScore ?? null,
      error:
        pipeline.status === "blocked"
          ? "Prompt bloqueado pelo Excellence Engine (score abaixo do mínimo)."
          : "Prompt precisa de regeneração antes de gerar imagem real.",
    };
  }

  return {
    approved: true,
    score: pipeline.score?.final_score ?? pipeline.result?.finalScore ?? null,
    error: null,
  };
}

async function uploadGeneratedMedia(params: {
  userId: string;
  assetId: string;
  buffer: Buffer;
  mimeType: string;
  extension: "png" | "webp" | "jpg";
}): Promise<{ storagePath: string; publicUrl: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { storagePath: "", publicUrl: "", error: "Usuário não autenticado." };

  const storagePath = buildCreativeGeneratedStoragePath(
    params.userId,
    params.assetId,
    params.extension
  );

  const { error: uploadError } = await ctx.supabase.storage.from(BUCKET).upload(storagePath, params.buffer, {
    contentType: params.mimeType,
    upsert: true,
  });

  if (uploadError) {
    return {
      storagePath: "",
      publicUrl: "",
      error: `Não foi possível salvar a imagem: ${uploadError.message}`,
    };
  }

  const { data: publicData } = ctx.supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: publicData.publicUrl,
    error: null,
  };
}

function resolveProvider(input?: CreativeMediaProviderId | null): CreativeMediaProviderId {
  const preferred = input ?? resolveDefaultImageProvider();
  if (isImageProviderAvailable(preferred)) return preferred;
  if (isImageProviderAvailable("openai")) return "openai";
  if (isImageProviderAvailable("flux")) return "flux";
  return preferred;
}

export async function getCreativeDirectorRealDashboard(): Promise<{
  dashboard: CreativeDirectorRealDashboard | null;
  assets: CreativeGeneratedAsset[];
  storageReady: boolean;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { dashboard: null, assets: [], storageReady: false, error: "Usuário não autenticado." };
  }

  const repo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const [{ data, error }, storageReady] = await Promise.all([
    repo.findAllOrdered(),
    checkCreativeFilesBucketReady(),
  ]);

  if (error) {
    return { dashboard: null, assets: [], storageReady, error };
  }

  const assets = data ?? [];
  return {
    dashboard: computeCreativeDirectorRealDashboard(assets),
    assets,
    storageReady,
    error: null,
  };
}

export async function generateRealCreativeAsset(input: CreativeGeneratedAssetIntake): Promise<{
  asset: CreativeGeneratedAsset | null;
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { asset: null, message: "", error: "Usuário não autenticado." };
  }

  const provider = resolveProvider(input.provider);
  if (!isImageProviderAvailable(provider)) {
    return {
      asset: null,
      message: "",
      error:
        provider === "flux"
          ? "FLUX_API_KEY não configurada."
          : "OPENAI_API_KEY não configurada para OpenAI Images.",
    };
  }

  const storageReady = await checkCreativeFilesBucketReady();
  if (!storageReady) {
    return {
      asset: null,
      message: "",
      error: "Bucket product-files não configurado no Supabase Storage.",
    };
  }

  const repo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const creativeId = input.creative_id?.trim() || null;
  let brief: CreativeAsset | null = null;

  if (creativeId) {
    const briefRepo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
    const { data } = await briefRepo.findById(creativeId);
    brief = data;
    if (!brief) {
      return { asset: null, message: "", error: "Brief criativo (creative_id) não encontrado." };
    }
  }

  const basePrompt =
    input.prompt?.trim() ||
    brief?.prompt?.trim() ||
    brief?.copy?.trim() ||
    "Professional digital product ad creative";

  const { data: pending, error: createError } = await repo.create({
    creative_id: creativeId,
    asset_type: input.asset_type,
    provider,
    status: "generating",
    prompt: basePrompt,
    metadata: {
      safe_mode: true,
      operation_id: input.operation_id ?? brief?.operation_id ?? null,
      title: input.title ?? brief?.title ?? null,
      copy: input.copy ?? brief?.copy ?? null,
    },
  } satisfies Omit<TableInsert<"creative_generated_assets">, "user_id">);

  if (createError || !pending) {
    return { asset: null, message: "", error: createError ?? "Erro ao iniciar geração." };
  }

  try {
    const optimizedPrompt = await optimizePromptForRealAsset({
      assetType: input.asset_type,
      basePrompt,
      copy: input.copy ?? brief?.copy,
      title: input.title ?? brief?.title,
    });

    await repo.update(pending.id, {
      prompt: optimizedPrompt,
      status: "prompt_ready",
    });

    const excellence = await reviewPromptWithExcellence({
      creativeId,
      optimizedPrompt,
      copy: input.copy ?? brief?.copy,
      title: input.title ?? brief?.title,
      module: "creative-director-real",
    });

    if (!excellence.approved) {
      const { data: blocked } = await repo.update(pending.id, {
        status: "blocked",
        metadata: {
          ...(pending.metadata as Record<string, unknown>),
          prompt_excellence: {
            score: excellence.score,
            approved: false,
          },
        } as Json,
      });

      return {
        asset: blocked,
        message: "",
        error: excellence.error ?? "Prompt não aprovado pelo Excellence Engine.",
      };
    }

    const media = await generateRealMedia({
      provider,
      prompt: optimizedPrompt,
      assetType: input.asset_type,
    });

    const { storagePath, publicUrl, error: uploadError } = await uploadGeneratedMedia({
      userId: ctx.userId,
      assetId: pending.id,
      buffer: media.buffer,
      mimeType: media.mimeType,
      extension: media.extension,
    });

    if (uploadError) {
      await repo.update(pending.id, { status: "failed" });
      return { asset: null, message: "", error: uploadError };
    }

    const previewUrl = buildCreativeGeneratedPreviewUrl(pending.id);
    const downloadUrl = buildCreativeGeneratedDownloadUrl(pending.id);

    const { data: asset, error: updateError } = await repo.update(pending.id, {
      status: "ready",
      file_url: publicUrl,
      thumbnail_url: publicUrl,
      metadata: {
        ...(pending.metadata as Record<string, unknown>),
        storage_path: storagePath,
        preview_url: previewUrl,
        download_url: downloadUrl,
        prompt_excellence: {
          score: excellence.score,
          approved: true,
        },
        provider_model: media.providerModel,
        dimensions: resolveMediaDimensions(input.asset_type).label,
        mime_type: media.mimeType,
      } as Json,
    });

    if (updateError || !asset) {
      return { asset: null, message: "", error: updateError ?? "Erro ao finalizar asset." };
    }

    return {
      asset,
      message: `${input.asset_type} real gerado via ${provider} · Excellence ${excellence.score ?? "—"}/100`,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof PreparedVideoProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro ao gerar asset real.";

    await repo.update(pending.id, { status: "failed" });
    return { asset: null, message: "", error: message };
  }
}

export async function generateRealAssetsForCreativeBriefs(
  briefs: CreativeAsset[],
  options?: { provider?: CreativeMediaProviderId }
): Promise<{
  assets: CreativeGeneratedAsset[];
  errors: string[];
}> {
  const generated: CreativeGeneratedAsset[] = [];
  const errors: string[] = [];

  for (const brief of briefs) {
    const generatedType = mapCreativeAssetToGeneratedType(brief.asset_type);
    if (!generatedType) continue;

    const { asset, error } = await generateRealCreativeAsset({
      asset_type: generatedType,
      creative_id: brief.id,
      provider: options?.provider,
      prompt: brief.prompt ?? undefined,
      copy: brief.copy ?? undefined,
      title: brief.title ?? undefined,
      operation_id: brief.operation_id,
    });

    if (asset) generated.push(asset);
    if (error) errors.push(`${brief.asset_type}: ${error}`);
  }

  return { assets: generated, errors };
}

export async function downloadRealCreativeAsset(assetId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  mimeType: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      buffer: null,
      fileName: "asset.png",
      mimeType: "image/png",
      error: "Usuário não autenticado.",
    };
  }

  const repo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const { data: asset, error: findError } = await repo.findById(assetId);

  if (findError || !asset) {
    return {
      buffer: null,
      fileName: "asset.png",
      mimeType: "image/png",
      error: findError ?? "Asset não encontrado.",
    };
  }

  if (asset.status !== "ready") {
    return {
      buffer: null,
      fileName: "asset.png",
      mimeType: "image/png",
      error: "Asset ainda não está pronto para download.",
    };
  }

  if (asset.creative_id) {
    const { requireExcellenceDelivery } = await import("./excellence-integration.service");
    const gate = await requireExcellenceDelivery("creative", asset.creative_id, {
      module: "creative-director-real",
    });
    if (!gate.allowed) {
      return {
        buffer: null,
        fileName: "asset.png",
        mimeType: "image/png",
        error: gate.error ?? "Download bloqueado pelo Excellence Engine.",
      };
    }
  }

  const meta = asset.metadata as Record<string, unknown> | null;
  const storagePath =
    typeof meta?.storage_path === "string" ? meta.storage_path : null;

  if (!storagePath) {
    return {
      buffer: null,
      fileName: "asset.png",
      mimeType: "image/png",
      error: "Arquivo não disponível no Storage.",
    };
  }

  const { data, error: downloadError } = await ctx.supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (downloadError || !data) {
    return {
      buffer: null,
      fileName: "asset.png",
      mimeType: "image/png",
      error: downloadError?.message ?? "Erro ao baixar arquivo.",
    };
  }

  const mimeType =
    typeof meta?.mime_type === "string" ? meta.mime_type : "image/png";
  const slug = (asset.asset_type ?? "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  return {
    buffer: await data.arrayBuffer(),
    fileName: `${slug}-${asset.id.slice(0, 8)}.png`,
    mimeType,
    error: null,
  };
}

export async function getRealCreativeAssetPreview(assetId: string): Promise<{
  asset: CreativeGeneratedAsset | null;
  previewUrl: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { asset: null, previewUrl: null, error: "Usuário não autenticado." };

  const repo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const { data: asset, error } = await repo.findById(assetId);

  if (error || !asset) {
    return { asset: null, previewUrl: null, error: error ?? "Asset não encontrado." };
  }

  if (asset.status !== "ready" || !asset.file_url) {
    return { asset, previewUrl: null, error: "Preview indisponível." };
  }

  return {
    asset,
    previewUrl: asset.file_url,
    error: null,
  };
}
