/**
 * Marketing channels registry — static guidance for acquisition.
 */

import type {
  MarketingChannelId,
  MarketingChannelRecord,
} from "@/lib/business-expert/types";

export const MARKETING_CHANNEL_REGISTRY: MarketingChannelRecord[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Descoberta visual e social proof.",
    category: "organic",
    strengths: ["prova social", "stories", "reels"],
    bestFor: ["infoproduto", "creator", "negocios-locais", "e-commerce"],
    tips: ["1 CTA por conteúdo", "prove resultado em 3s"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Alcance orgânico via criativos curtos.",
    category: "organic",
    strengths: ["virality", "custo de teste baixo"],
    bestFor: ["afiliado", "creator", "infoproduto", "e-commerce"],
    tips: ["hooks fortes", "volume de testes"],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Autoridade e SEO de vídeo de longo prazo.",
    category: "organic",
    strengths: ["evergreen", "confiança"],
    bestFor: ["curso", "saas", "consultoria", "mentoria"],
    tips: ["problema no título", "CTA no meio e fim"],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Intenção de planejamento e busca visual.",
    category: "organic",
    strengths: ["intenção", "longevidade do pin"],
    bestFor: ["e-commerce", "template", "produto-digital"],
    tips: ["keywords nos pins", "landing clara"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "B2B, autoridade profissional e networking.",
    category: "organic",
    strengths: ["B2B", "leads qualificados"],
    bestFor: ["consultoria", "saas", "agencia", "mentoria"],
    tips: ["cases", "opiniões com dados"],
  },
  {
    id: "threads",
    name: "Threads",
    description: "Conversas rápidas e distribuição text-first.",
    category: "organic",
    strengths: ["conversa", "low friction"],
    bestFor: ["creator", "infoproduto", "consultoria"],
    tips: ["séries curtas", "CTA para lista"],
  },
  {
    id: "seo",
    name: "SEO",
    description: "Tráfego de busca orgânica de longo prazo.",
    category: "organic",
    strengths: ["baixo CAC no longo prazo", "owned content"],
    bestFor: ["saas", "e-commerce", "consultoria"],
    tips: ["intenção de compra", "conteúdo útil > volume"],
  },
  {
    id: "google-ads",
    name: "Google Ads",
    description: "Demanda capturada por intenção de busca.",
    category: "paid",
    strengths: ["intenção alta", "mensurável"],
    bestFor: ["saas", "prestacao-de-servico", "e-commerce"],
    tips: ["landing alinhada", "CPA por oferta"],
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    description: "Tráfego pago Facebook/Instagram.",
    category: "paid",
    strengths: ["escala criativa", "remarketing"],
    bestFor: ["infoproduto", "e-commerce", "afiliado"],
    tips: ["teste criativo", "pixel/events"],
  },
  {
    id: "tiktok-ads",
    name: "TikTok Ads",
    description: "Tráfego pago com criativos nativos.",
    category: "paid",
    strengths: ["atenção barata em testes", "UGC style"],
    bestFor: ["afiliado", "e-commerce", "creator"],
    tips: ["criativo nativo", "oferta clara"],
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "Relacionamento e conversão ownership.",
    category: "hybrid",
    strengths: ["owned media", "nurture"],
    bestFor: ["curso", "assinatura", "saas", "newsletter"],
    tips: ["sequência de onboarding", "1 oferta por vez"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Conversão e suporte em conversas 1:1 e listas.",
    category: "hybrid",
    strengths: ["alta abertura", "fechamento local"],
    bestFor: ["negocios-locais", "prestacao-de-servico", "agencia", "mentoria"],
    tips: ["script de qualificação", "não spam"],
  },
];

const byId = new Map(MARKETING_CHANNEL_REGISTRY.map((c) => [c.id, c] as const));

export function listMarketingChannels(): MarketingChannelRecord[] {
  return [...MARKETING_CHANNEL_REGISTRY];
}

export function getMarketingChannel(
  id: MarketingChannelId
): MarketingChannelRecord | undefined {
  return byId.get(id);
}
