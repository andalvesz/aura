import type { CreativeAsset, CreativeAssetType } from "@/types/database";
import { getCreativeAssetTypeLabel } from "@/utils/creative-factory";

export const CREATIVE_DIRECTOR_SAFE_MODE = {
  active: true,
  message:
    "Creative Director gera imagens reais, revisa com Excellence e salva no Storage — não publica anúncios automaticamente.",
};

/** Ativos incluídos em cada pacote criativo Elite por operação. */
export const CREATIVE_PACKAGE_ASSET_TYPES: CreativeAssetType[] = [
  "image",
  "carousel",
  "banner",
  "thumbnail",
  "ugc_script",
  "reel_script",
  "vsl_script",
  "headline_variations",
  "cta_variations",
];

export const CREATIVE_EXCELLENCE_MIN = 85;
export const CREATIVE_EXCELLENCE_MAX_CYCLES = 3;

export type CreativeQualityScore = {
  ctr_previsto: number;
  clareza: number;
  emocao: number;
  contraste: number;
  legibilidade: number;
  oferta: number;
  overall: number;
};

export type CreativeScoreDimension =
  | "clareza"
  | "promessa"
  | "curiosidade"
  | "dor"
  | "cta"
  | "risco_reprovacao";

export type CreativeScore = {
  clareza: number;
  promessa: number;
  curiosidade: number;
  dor: number;
  cta: number;
  risco_reprovacao: number;
  overall: number;
};

export const CREATIVE_SCORE_LABELS: Record<CreativeScoreDimension, string> = {
  clareza: "Clareza",
  promessa: "Promessa",
  curiosidade: "Curiosidade",
  dor: "Dor",
  cta: "CTA",
  risco_reprovacao: "Risco de reprovação",
};

export type CreativeDirectorMetadata = {
  package_id?: string;
  asset_ids?: string[];
  generated_asset_ids?: string[];
  generated_at?: string;
  creative_score?: CreativeScore;
  creative_quality_score?: CreativeQualityScore;
  regeneration_cycles?: number;
  storage_path?: string;
  ready?: boolean;
  asset_count?: number;
  delivered_count?: number;
};

export type CreativePackageAssetEntry = {
  id: string;
  asset_type: CreativeAssetType;
  title: string | null;
  copy: string | null;
  format: string | null;
  download_url: string;
  content: unknown;
};

export type CreativePackageManifest = {
  package_id: string;
  operation_id: string;
  product_id: string | null;
  generated_at: string;
  safe_mode: boolean;
  auto_publish: false;
  creative_score: CreativeScore;
  creative_quality_score?: CreativeQualityScore;
  integrations: {
    copylab: boolean;
    growth_brain: boolean;
    revenue_ai: boolean;
    meta_intelligence: boolean;
    operation_center: boolean;
  };
  assets: CreativePackageAssetEntry[];
};

export function buildCreativePackageStoragePath(
  userId: string,
  operationId: string,
  packageId: string
): string {
  return `creative-packages/${userId}/${operationId}/${packageId}.json`;
}

export function buildCreativeDirectorDownloadUrl(operationId: string): string {
  return `/api/creative-director/download/${operationId}`;
}

export function readCreativeDirectorMetadata(metadata: unknown): CreativeDirectorMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const root = metadata as Record<string, unknown>;
  const cd = root.creative_director;
  if (!cd || typeof cd !== "object" || Array.isArray(cd)) return null;

  const director = cd as Record<string, unknown>;
  const scoreRaw = director.creative_score;
  let creative_score: CreativeScore | undefined;

  if (scoreRaw && typeof scoreRaw === "object" && !Array.isArray(scoreRaw)) {
    const s = scoreRaw as Record<string, unknown>;
    creative_score = {
      clareza: clampScore(s.clareza),
      promessa: clampScore(s.promessa),
      curiosidade: clampScore(s.curiosidade),
      dor: clampScore(s.dor),
      cta: clampScore(s.cta),
      risco_reprovacao: clampScore(s.risco_reprovacao),
      overall: clampScore(s.overall),
    };
  }

  const assetIds = Array.isArray(director.asset_ids)
    ? director.asset_ids.filter((id): id is string => typeof id === "string")
    : undefined;

  const generatedAssetIds = Array.isArray(director.generated_asset_ids)
    ? director.generated_asset_ids.filter((id): id is string => typeof id === "string")
    : undefined;

  const packageId =
    typeof director.package_id === "string" ? director.package_id : undefined;
  const generatedAt =
    typeof director.generated_at === "string" ? director.generated_at : undefined;
  const storagePath =
    typeof director.storage_path === "string" ? director.storage_path : undefined;
  const ready = director.ready === true;
  const assetCount =
    typeof director.asset_count === "number" ? director.asset_count : assetIds?.length;
  const deliveredCount =
    typeof director.delivered_count === "number"
      ? director.delivered_count
      : generatedAssetIds?.length;

  if (!packageId && !assetIds?.length && !generatedAssetIds?.length && !creative_score) {
    return null;
  }

  return {
    package_id: packageId,
    asset_ids: assetIds,
    generated_asset_ids: generatedAssetIds,
    generated_at: generatedAt,
    creative_score,
    storage_path: storagePath,
    ready,
    asset_count: assetCount,
    delivered_count: deliveredCount,
  };
}

export function mergeCreativeDirectorMetadata(
  metadata: unknown,
  update: CreativeDirectorMetadata
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const existing = readCreativeDirectorMetadata(base) ?? {};

  return {
    ...base,
    creative_director: {
      ...existing,
      ...update,
      asset_ids: update.asset_ids ?? existing.asset_ids,
      generated_asset_ids: update.generated_asset_ids ?? existing.generated_asset_ids,
    },
  };
}

export function hasCreativeDirectorPackage(metadata: unknown): boolean {
  const director = readCreativeDirectorMetadata(metadata);
  return Boolean(
    director?.ready &&
      ((director.generated_asset_ids?.length ?? 0) > 0 ||
        (director.delivered_count ?? 0) > 0 ||
        (director.asset_ids?.length ?? 0) > 0)
  );
}

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function computeCreativeQualityScore(params: {
  creativeScore: CreativeScore;
  assets: CreativeAsset[];
  copyHeadline?: string | null;
}): CreativeQualityScore {
  const readyAssets = params.assets.filter((a) => a.status === "ready");
  const typesPresent = new Set(readyAssets.map((a) => a.asset_type));
  const completeness =
    CREATIVE_PACKAGE_ASSET_TYPES.filter((t) => typesPresent.has(t)).length /
    CREATIVE_PACKAGE_ASSET_TYPES.length;

  const copySamples = readyAssets
    .map((a) => a.copy ?? a.title ?? "")
    .filter(Boolean)
    .join(" ");

  const hasHeadline = Boolean(params.copyHeadline?.trim());
  const hasOffer = /oferta|bônus|bonus|garantia|desconto|grátis|free/i.test(copySamples);
  const hasEmotion = /transform|sonho|medo|frustra|urgente|agora|você/i.test(copySamples);

  const ctr_previsto = clampScore(
    params.creativeScore.overall * 0.5 +
      (hasHeadline ? 15 : 0) +
      completeness * 25 +
      (params.creativeScore.curiosidade > 60 ? 10 : 0)
  );
  const clareza = params.creativeScore.clareza;
  const emocao = clampScore(
    (params.creativeScore.dor + params.creativeScore.promessa) / 2 + (hasEmotion ? 10 : 0)
  );
  const contraste = clampScore(55 + completeness * 30 + (typesPresent.has("thumbnail") ? 10 : 0));
  const legibilidade = clampScore(
    clareza * 0.6 + (copySamples.split(/\s+/).length > 20 ? 25 : 10) + (typesPresent.has("headline_variations") ? 15 : 0)
  );
  const oferta = clampScore(
    params.creativeScore.cta * 0.5 + params.creativeScore.promessa * 0.3 + (hasOffer ? 20 : 0)
  );

  const overall = clampScore(
    ctr_previsto * 0.2 +
      clareza * 0.15 +
      emocao * 0.15 +
      contraste * 0.15 +
      legibilidade * 0.15 +
      oferta * 0.2
  );

  return { ctr_previsto, clareza, emocao, contraste, legibilidade, oferta, overall };
}

export function isCreativeDeliverable(score: number): boolean {
  return score >= CREATIVE_EXCELLENCE_MIN;
}

export function computeOverallCreativeScore(score: Omit<CreativeScore, "overall">): number {
  const positive =
    score.clareza +
    score.promessa +
    score.curiosidade +
    score.dor +
    score.cta;
  const adjusted = positive / 5 - score.risco_reprovacao * 0.25;
  return clampScore(adjusted);
}

export function computeHeuristicCreativeScore(params: {
  assets: CreativeAsset[];
  copyHeadline?: string | null;
  metaRejectionHints?: string[];
}): CreativeScore {
  const readyAssets = params.assets.filter((a) => a.status === "ready");
  const typesPresent = new Set(readyAssets.map((a) => a.asset_type));
  const completeness =
    CREATIVE_PACKAGE_ASSET_TYPES.filter((t) => typesPresent.has(t)).length /
    CREATIVE_PACKAGE_ASSET_TYPES.length;

  const copySamples = readyAssets
    .map((a) => a.copy ?? a.title ?? "")
    .filter(Boolean)
    .join(" ");

  const wordCount = copySamples.split(/\s+/).filter(Boolean).length;
  const hasHeadline = Boolean(params.copyHeadline?.trim());
  const hasCta = /cta|compre|garanta|acesse|clique|inscreva/i.test(copySamples);

  const clareza = clampScore(55 + completeness * 25 + (wordCount > 40 ? 10 : 0));
  const promessa = clampScore(50 + (hasHeadline ? 20 : 5) + completeness * 20);
  const curiosidade = clampScore(45 + (/como|segredo|descubra|você sabia/i.test(copySamples) ? 25 : 10));
  const dor = clampScore(40 + (/problema|frustrad|dificuldade|dor|sofre/i.test(copySamples) ? 35 : 15));
  const cta = clampScore(40 + (hasCta ? 40 : 10) + (typesPresent.has("cta_variations") ? 15 : 0));

  let risco = 25;
  if (/garantido|100%|milagre|cura|enriqueça rápido/i.test(copySamples)) risco += 25;
  if (params.metaRejectionHints?.length) {
    risco += Math.min(30, params.metaRejectionHints.length * 8);
  }
  risco = clampScore(risco);

  const partial = { clareza, promessa, curiosidade, dor, cta, risco_reprovacao: risco };
  return { ...partial, overall: computeOverallCreativeScore(partial) };
}

export function buildCreativePackageManifest(params: {
  packageId: string;
  operationId: string;
  productId: string | null;
  creativeScore: CreativeScore;
  creativeQualityScore?: CreativeQualityScore;
  assets: CreativePackageAssetEntry[];
  integrations: CreativePackageManifest["integrations"];
}): CreativePackageManifest {
  return {
    package_id: params.packageId,
    operation_id: params.operationId,
    product_id: params.productId,
    generated_at: new Date().toISOString(),
    safe_mode: CREATIVE_DIRECTOR_SAFE_MODE.active,
    auto_publish: false,
    creative_score: params.creativeScore,
    creative_quality_score: params.creativeQualityScore,
    integrations: params.integrations,
    assets: params.assets,
  };
}

export function summarizeCreativePackage(assets: CreativeAsset[]): string {
  if (assets.length === 0) return "Pacote criativo vazio.";
  return assets
    .map((a) => `${getCreativeAssetTypeLabel(a.asset_type)}: ${a.title ?? a.id}`)
    .join(" · ");
}

export function getCreativeScoreColor(score: number): string {
  if (score >= CREATIVE_EXCELLENCE_MIN) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
}
