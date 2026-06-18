import type { CreativeGeneratedAssetType, CreativeMediaProviderId } from "@/types/database";

export type CreativeMediaDimensions = {
  width: number;
  height: number;
  openAiSize: "1024x1024" | "1024x1792" | "1792x1024";
  label: string;
};

export type CreativeMediaProviderConfig = {
  id: CreativeMediaProviderId;
  label: string;
  supportsImage: boolean;
  supportsVideo: boolean;
  available: boolean;
  envKey: string | null;
  description: string;
};

export const CREATIVE_MEDIA_PROVIDERS: CreativeMediaProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI Images",
    supportsImage: true,
    supportsVideo: false,
    available: true,
    envKey: "OPENAI_API_KEY",
    description: "DALL-E 3 — geração de imagens PNG em alta qualidade.",
  },
  {
    id: "flux",
    label: "Flux",
    supportsImage: true,
    supportsVideo: false,
    available: true,
    envKey: "FLUX_API_KEY",
    description: "Black Forest Labs Flux — imagens fotorrealistas.",
  },
  {
    id: "runway",
    label: "Runway",
    supportsImage: false,
    supportsVideo: true,
    available: false,
    envKey: "RUNWAY_API_KEY",
    description: "Estrutura preparada — vídeo via Runway Gen-3 (em breve).",
  },
  {
    id: "kling",
    label: "Kling",
    supportsImage: false,
    supportsVideo: true,
    available: false,
    envKey: "KLING_API_KEY",
    description: "Estrutura preparada — vídeo via Kling (em breve).",
  },
  {
    id: "veo",
    label: "Veo",
    supportsImage: false,
    supportsVideo: true,
    available: false,
    envKey: "VEO_API_KEY",
    description: "Estrutura preparada — vídeo via Google Veo (em breve).",
  },
];

export const CREATIVE_GENERATED_ASSET_TYPES: CreativeGeneratedAssetType[] = [
  "image",
  "carousel",
  "story",
  "thumbnail",
  "reel_cover",
  "ugc_frame",
];

export const CREATIVE_GENERATED_ASSET_LABELS: Record<CreativeGeneratedAssetType, string> = {
  image: "Imagem",
  carousel: "Carrossel",
  story: "Story",
  thumbnail: "Thumbnail",
  reel_cover: "Capa Reels",
  ugc_frame: "Frame UGC",
};

export const CREATIVE_GENERATED_STATUS_LABELS: Record<
  import("@/types/database").CreativeGeneratedAssetStatus,
  string
> = {
  briefing: "Briefing",
  generating: "Gerando imagem",
  reviewing: "Revisão Excellence",
  approved: "Aprovado",
  blocked: "Bloqueado",
  delivered: "Entregue",
  failed: "Falhou",
};

export function resolveMediaDimensions(assetType: CreativeGeneratedAssetType): CreativeMediaDimensions {
  switch (assetType) {
    case "story":
    case "reel_cover":
    case "ugc_frame":
      return {
        width: 1080,
        height: 1920,
        openAiSize: "1024x1792",
        label: "1080×1920 vertical",
      };
    case "thumbnail":
      return {
        width: 1280,
        height: 720,
        openAiSize: "1792x1024",
        label: "1280×720 horizontal",
      };
    case "carousel":
    case "image":
    default:
      return {
        width: 1080,
        height: 1080,
        openAiSize: "1024x1024",
        label: "1080×1080 quadrado",
      };
  }
}

export function isProviderConfigured(provider: CreativeMediaProviderId): boolean {
  const config = CREATIVE_MEDIA_PROVIDERS.find((p) => p.id === provider);
  if (!config?.envKey) return false;
  return Boolean(process.env[config.envKey]?.trim());
}

export function resolveDefaultImageProvider(): CreativeMediaProviderId {
  if (isProviderConfigured("openai")) return "openai";
  if (isProviderConfigured("flux")) return "flux";
  return "openai";
}

export function mapCreativeAssetToGeneratedType(
  assetType: string
): CreativeGeneratedAssetType | null {
  const map: Record<string, CreativeGeneratedAssetType> = {
    image: "image",
    carousel: "carousel",
    banner: "image",
    thumbnail: "thumbnail",
    ugc_script: "ugc_frame",
    reel_script: "reel_cover",
  };
  return map[assetType] ?? null;
}

export class PreparedVideoProviderError extends Error {
  readonly provider: CreativeMediaProviderId;

  constructor(provider: CreativeMediaProviderId) {
    super(
      `Provider ${provider} preparado para integração futura. Use openai ou flux para imagens reais.`
    );
    this.name = "PreparedVideoProviderError";
    this.provider = provider;
  }
}
