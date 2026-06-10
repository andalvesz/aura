import type { CreatorAsset } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { formatBRL } from "@/utils/creator";
import type { CreatorLocalePartial } from "@/utils/creator-locale";
import { localeFieldsFromSource } from "@/utils/creator-locale";
import { parseJsonStringArray } from "@/utils/research";

export type StudioIntake = {
  nome: string;
  avatar: string;
  problema: string;
  solucao: string;
  promessa: string;
  diferencial: string;
  preco: number | null;
  product_id?: string | null;
  copylab_id?: string | null;
  asset_id?: string | null;
} & CreatorLocalePartial;

export type StudioGenerateKind =
  | "criativo"
  | "roteiro"
  | "carrossel"
  | "thumbnail"
  | "vsl"
  | "social"
  | "full";

export type GeneratedStudioCriativo = {
  criativo_facebook: string;
  criativo_instagram: string;
  mockup_produto: string;
};

export type GeneratedStudioRoteiro = {
  roteiro_reels: string;
  roteiro_shorts: string;
  roteiro_tiktok: string;
};

export type GeneratedStudioThumbnail = {
  capa_ebook: string;
  thumbnail_youtube: string;
};

export type GeneratedStudioCarrossel = {
  carrossel_instagram: string[];
};

export type GeneratedStudioVsl = {
  vsl: string;
};

export type GeneratedStudioSocial = {
  stories: string[];
  legendas: string;
  cta: string;
};

export type GeneratedStudioFull = GeneratedStudioCriativo &
  GeneratedStudioRoteiro &
  GeneratedStudioThumbnail &
  GeneratedStudioCarrossel &
  GeneratedStudioVsl &
  GeneratedStudioSocial;

export type StudioDashboardMetrics = {
  totalAssets: number;
  ultimoProduto: string;
  comRoteiro: number;
  comCriativos: number;
  vinculados: number;
};

export const STUDIO_AI_CONTEXT = `Você é a Aura Creative Studio — diretor de arte e conteúdo para produtos digitais globais.
Gere briefings de criativos, roteiros de vídeo, carrosséis, thumbnails e copy para social media.
Adapte visual, texto, CTA e cultura local ao país, idioma e moeda do mercado alvo.
Tom persuasivo, visual e autêntico no idioma do produto.`;

export const STUDIO_IA_ACTIONS = [
  {
    id: "gerar-criativo",
    label: "Gerar Criativo",
    prompt: "Gere criativos para Facebook e Instagram do meu produto.",
  },
  {
    id: "gerar-roteiro",
    label: "Gerar Roteiro",
    prompt: "Crie roteiros para Reels, Shorts e TikTok do meu produto.",
  },
  {
    id: "gerar-carrossel",
    label: "Gerar Carrossel",
    prompt: "Crie um carrossel completo para Instagram.",
  },
  {
    id: "gerar-thumbnail",
    label: "Gerar Thumbnail",
    prompt: "Gere thumbnail para YouTube e capa de ebook.",
  },
  {
    id: "gerar-vsl",
    label: "Gerar VSL",
    prompt: "Crie o roteiro completo de uma VSL para meu produto.",
  },
] as const;

const STUDIO_CREATIVES_PHRASES = [
  "crie os criativos",
  "criar os criativos",
  "gere os criativos",
  "gerar os criativos",
  "crie criativos",
] as const;

const STUDIO_AD_PHRASES = [
  "crie um anuncio",
  "criar um anuncio",
  "crie um anúncio",
  "criar um anúncio",
  "gere um anuncio",
  "crie anuncio",
] as const;

const STUDIO_REELS_PHRASES = [
  "crie um roteiro para reels",
  "criar um roteiro para reels",
  "roteiro para reels",
  "crie roteiro reels",
  "roteiro de reels",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type StudioCoachMode = "studio-creatives" | "studio-ad" | "studio-reels";

export function detectStudioCoachMode(message: string): StudioCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, STUDIO_REELS_PHRASES)) return "studio-reels";
  if (matchesAny(normalized, STUDIO_AD_PHRASES)) return "studio-ad";
  if (matchesAny(normalized, STUDIO_CREATIVES_PHRASES)) return "studio-creatives";
  return null;
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): StudioIntake {
  const { product } = bundle;
  const preco = product.faixa_preco_max ?? product.faixa_preco_min ?? null;

  return {
    nome: product.nome ?? "",
    avatar: product.avatar ?? "",
    problema: product.problema ?? "",
    solucao: product.solucao ?? "",
    promessa: product.promessa ?? "",
    diferencial: product.diferenciais ?? "",
    preco,
    product_id: product.id,
    copylab_id: null,
    ...localeFieldsFromSource(product),
  };
}

export function computeStudioDashboard(records: CreatorAsset[]): StudioDashboardMetrics {
  const ultimo = records[0];
  const comRoteiro = records.filter((r) => r.roteiro_reels?.trim()).length;
  const comCriativos = records.filter(
    (r) => r.criativo_facebook?.trim() || r.criativo_instagram?.trim()
  ).length;
  const vinculados = records.filter((r) => r.product_id).length;

  return {
    totalAssets: records.length,
    ultimoProduto: ultimo?.nome ?? "—",
    comRoteiro,
    comCriativos,
    vinculados,
  };
}

export function buildStudioAuraContext(records: CreatorAsset[]): string {
  if (records.length === 0) return "Nenhum ativo gerado no Creative Studio.";

  return records
    .slice(0, 5)
    .map((r) => {
      const slides = parseJsonStringArray(r.carrossel_instagram).length;
      return `• ${r.nome ?? "Produto"} — criativos: ${r.criativo_facebook ? "FB" : "—"}/${r.criativo_instagram ? "IG" : "—"} · roteiro: ${r.roteiro_reels ? "sim" : "—"} · carrossel: ${slides} slides`;
    })
    .join("\n");
}

export function buildStudioCoachReply(params: {
  mode: StudioCoachMode;
  displayName: string;
  records: CreatorAsset[];
  bundles: CreatorProductBundle[];
}): string {
  const { mode, displayName, records, bundles } = params;
  const greeting = displayName ? `${displayName}, ` : "";

  if (mode === "studio-creatives") {
    const latest = records[0];
    if (latest?.criativo_facebook || latest?.criativo_instagram) {
      return `${greeting}você já tem criativos no Creative Studio para **${latest.nome ?? "seu produto"}**.

**Facebook:** ${latest.criativo_facebook?.slice(0, 200) ?? "—"}…

**Instagram:** ${latest.criativo_instagram?.slice(0, 200) ?? "—"}…

Abra **Aura Creative Studio** (/dashboard/creator/studio) para gerar novos ou atualizar.`;
    }

    const product = bundles[0]?.product;
    return `${greeting}ainda não há criativos gerados.

${product ? `Produto disponível: **${product.nome}**` : "Crie um produto no Creator primeiro."}

1. Abra **Aura Creative Studio** → /dashboard/creator/studio
2. Selecione o produto ou preencha os dados
3. Clique em **Gerar Criativo**`;
  }

  if (mode === "studio-ad") {
    const latest = records[0];
    if (latest?.criativo_facebook) {
      return `${greeting}aqui está o anúncio para Facebook:

${latest.criativo_facebook}

${latest.cta ? `**CTA:** ${latest.cta}` : ""}

Para Instagram, abra o Creative Studio — o criativo IG também está disponível.`;
    }

    return `${greeting}para criar um anúncio, use o **Creative Studio** (/dashboard/creator/studio).

Clique em **Gerar Criativo** — a IA gera briefing completo com headline, corpo, visual e CTA para Facebook e Instagram.`;
  }

  if (mode === "studio-reels") {
    const latest = records.find((r) => r.roteiro_reels?.trim());
    if (latest?.roteiro_reels) {
      return `${greeting}roteiro para Reels de **${latest.nome ?? "produto"}**:

${latest.roteiro_reels.slice(0, 800)}${latest.roteiro_reels.length > 800 ? "…" : ""}

Abra **Creative Studio** para ver roteiros de Shorts e TikTok também.`;
    }

    return `${greeting}ainda não há roteiro de Reels.

1. Abra **Aura Creative Studio** → /dashboard/creator/studio
2. Vincule um produto do Creator
3. Clique em **Gerar Roteiro**`;
  }

  return `${greeting}abra o Creative Studio em /dashboard/creator/studio.`;
}

export { formatBRL };
