/**
 * Knowledge packs — curated bundles for ingestion into Knowledge Hub (no hub fork).
 */

import type {
  KnowledgePackDefinition,
  KnowledgePackId,
} from "@/lib/business-expert/types";

export const KNOWLEDGE_PACKS: KnowledgePackDefinition[] = [
  {
    id: "business-pack",
    name: "Business Pack",
    summary: "Fundamentos de empreendedorismo, validação e oferta.",
    domains: ["empreendedorismo", "validacao", "oferta", "modelos-de-negocio"],
    articleIds: ["kn-validacao-01", "kn-modelo-01", "kn-oferta-01"],
    relatedModes: ["produtor", "startup", "prestador"],
    sourcesAllowed: ["pdf", "docx", "article", "course", "link"],
  },
  {
    id: "affiliate-pack",
    name: "Affiliate Pack",
    summary: "Playbook de afiliados, plataformas e conteúdo.",
    domains: ["marketing", "aquisicao", "vendas", "oferta"],
    articleIds: ["kn-afiliado-01", "kn-marketing-01"],
    relatedModes: ["afiliado", "creator"],
    sourcesAllowed: ["pdf", "article", "link", "course"],
  },
  {
    id: "marketing-pack",
    name: "Marketing Pack",
    summary: "Canais, aquisição e branding.",
    domains: ["marketing", "aquisicao", "branding", "posicionamento"],
    articleIds: ["kn-marketing-01", "kn-branding-01", "kn-aquisicao-01"],
    relatedModes: ["creator", "agencia", "produtor"],
    sourcesAllowed: ["pdf", "docx", "article", "link"],
  },
  {
    id: "kiwify-pack",
    name: "Kiwify Pack",
    summary: "Documentação e práticas Kiwify (ingestão + builtin).",
    domains: ["produto", "vendas", "monetizacao"],
    articleIds: ["kn-kiwify-01"],
    relatedModes: ["produtor", "afiliado"],
    sourcesAllowed: ["pdf", "link", "article", "course"],
  },
  {
    id: "hotmart-pack",
    name: "Hotmart Pack",
    summary: "Marketplace Hotmart: produtor e afiliado.",
    domains: ["vendas", "aquisicao", "monetizacao"],
    articleIds: ["kn-hotmart-01"],
    relatedModes: ["produtor", "afiliado"],
    sourcesAllowed: ["pdf", "link", "article", "course"],
  },
  {
    id: "saas-pack",
    name: "SaaS Pack",
    summary: "Validação, pricing e growth de SaaS.",
    domains: ["produto", "growth", "preco", "retencao", "financeiro"],
    articleIds: ["kn-saas-01", "kn-retencao-01"],
    relatedModes: ["startup"],
    sourcesAllowed: ["pdf", "docx", "article", "course", "link"],
  },
  {
    id: "local-business-pack",
    name: "Local Business Pack",
    summary: "Operação, marketing e finanças de negócios locais.",
    domains: ["operacao", "marketing", "financeiro", "aquisicao"],
    articleIds: ["kn-local-01", "kn-operacao-01"],
    relatedModes: ["empresa-local"],
    sourcesAllowed: ["pdf", "docx", "article", "link"],
  },
  {
    id: "growth-pack",
    name: "Growth Pack",
    summary: "Aquisição, retenção e experimentação.",
    domains: ["growth", "aquisicao", "retencao", "escala"],
    articleIds: ["kn-growth-01", "kn-retencao-01"],
    relatedModes: ["startup", "creator", "produtor"],
    sourcesAllowed: ["pdf", "article", "course", "link"],
  },
];

const byId = new Map(KNOWLEDGE_PACKS.map((p) => [p.id, p] as const));

export function listKnowledgePacks(): KnowledgePackDefinition[] {
  return [...KNOWLEDGE_PACKS];
}

export function getKnowledgePack(
  id: KnowledgePackId
): KnowledgePackDefinition | undefined {
  return byId.get(id);
}
