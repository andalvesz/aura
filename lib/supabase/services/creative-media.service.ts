import OpenAI from "openai";
import type { CreativeGeneratedAssetType, CreativeMediaProviderId } from "@/types/database";
import {
  PreparedVideoProviderError,
  resolveMediaDimensions,
  type CreativeMediaDimensions,
} from "@/utils/creative-media-providers";

export type GeneratedMediaResult = {
  buffer: Buffer;
  mimeType: string;
  extension: "png" | "webp" | "jpg";
  width: number;
  height: number;
  provider: CreativeMediaProviderId;
  providerModel: string;
};

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function pollFluxResult(params: {
  apiKey: string;
  pollingUrl: string;
  maxAttempts?: number;
}): Promise<string> {
  const maxAttempts = params.maxAttempts ?? 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(params.pollingUrl, {
      headers: {
        accept: "application/json",
        "x-key": params.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Flux polling falhou: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      status?: string;
      result?: { sample?: string };
      error?: string;
    };

    if (payload.status === "Ready" && payload.result?.sample) {
      return payload.result.sample;
    }

    if (payload.status === "Error" || payload.status === "Failed") {
      throw new Error(payload.error ?? "Flux retornou erro na geração.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Flux excedeu tempo de espera na geração.");
}

async function generateWithOpenAi(params: {
  prompt: string;
  dimensions: CreativeMediaDimensions;
}): Promise<GeneratedMediaResult> {
  const openai = getOpenAi();
  if (!openai) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: params.prompt,
    n: 1,
    size: params.dimensions.openAiSize,
    response_format: "b64_json",
    quality: "standard",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI Images não retornou imagem.");
  }

  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: "image/png",
    extension: "png",
    width: params.dimensions.width,
    height: params.dimensions.height,
    provider: "openai",
    providerModel: "dall-e-3",
  };
}

async function generateWithFlux(params: {
  prompt: string;
  dimensions: CreativeMediaDimensions;
}): Promise<GeneratedMediaResult> {
  const apiKey = process.env.FLUX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("FLUX_API_KEY não configurada.");
  }

  const response = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      width: params.dimensions.width,
      height: params.dimensions.height,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Flux API falhou: HTTP ${response.status} — ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    id?: string;
    polling_url?: string;
    error?: string;
  };

  if (!payload.polling_url) {
    throw new Error(payload.error ?? "Flux não retornou polling_url.");
  }

  const imageUrl = await pollFluxResult({ apiKey, pollingUrl: payload.polling_url });
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Não foi possível baixar imagem do Flux.");
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const extension: "png" | "webp" | "jpg" = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType,
    extension,
    width: params.dimensions.width,
    height: params.dimensions.height,
    provider: "flux",
    providerModel: "flux-pro-1.1",
  };
}

export async function generateRealMedia(params: {
  provider: CreativeMediaProviderId;
  prompt: string;
  assetType: CreativeGeneratedAssetType;
}): Promise<GeneratedMediaResult> {
  const dimensions = resolveMediaDimensions(params.assetType);

  switch (params.provider) {
    case "openai":
      return generateWithOpenAi({ prompt: params.prompt, dimensions });
    case "flux":
      return generateWithFlux({ prompt: params.prompt, dimensions });
    case "runway":
    case "kling":
    case "veo":
      throw new PreparedVideoProviderError(params.provider);
    default:
      throw new Error(`Provider desconhecido: ${String(params.provider)}`);
  }
}

export function isImageProviderAvailable(provider: CreativeMediaProviderId): boolean {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (provider === "flux") return Boolean(process.env.FLUX_API_KEY?.trim());
  return false;
}
