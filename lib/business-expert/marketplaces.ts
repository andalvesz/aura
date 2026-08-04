/**
 * Marketplace platform registry — static product knowledge.
 * Fees/rankings that change frequently should go through web research provider.
 */

import type { MarketplaceId, MarketplaceRecord } from "@/lib/business-expert/types";

export const MARKETPLACE_REGISTRY: MarketplaceRecord[] = [
  {
    id: "kiwify",
    name: "Kiwify",
    description: "Plataforma BR para infoprodutos com checkout e área de membros.",
    category: "infoproduct",
    useCases: ["curso online", "mentoria", "assinatura digital", "afiliados"],
    advantages: ["UX simples", "checkout BR", "afiliados nativos", "comunidade grande"],
    limitations: ["Ecossistema menos global", "dependência de mudanças de regras"],
    businessTypes: ["infoproduto", "curso", "assinatura", "mentoria", "afiliado"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://kiwify.com.br (conferir docs oficiais)",
    futureIntegrations: ["automations", "crm-sync"],
    guidanceNote: "Compare taxas e programa de afiliados com pesquisa atualizada.",
  },
  {
    id: "hotmart",
    name: "Hotmart",
    description: "Marketplace e plataforma global de produtos digitais.",
    category: "infoproduct-marketplace",
    useCases: ["marketplace de cursos", "afiliados", "clubes", "produtos digitais"],
    advantages: ["alcance de afiliados", "marca consolidada", "ferramentas de vendor"],
    limitations: ["taxas e políticas variáveis", "concorrência interna alta"],
    businessTypes: ["infoproduto", "curso", "afiliado", "comunidade"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://hotmart.com (docs oficiais)",
    futureIntegrations: ["pixel", "webhooks"],
    guidanceNote: "Use pesquisa web para taxas e ranking de afiliados atuais.",
  },
  {
    id: "eduzz",
    name: "Eduzz",
    description: "Ecossistema BR de lançamentos e infoprodutos.",
    category: "infoproduct",
    useCases: ["lançamentos", "assinatura", "afiliados"],
    advantages: ["stack de marketing", "público BR"],
    limitations: ["curva de aprendizado de tools"],
    businessTypes: ["infoproduto", "curso", "afiliado"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://eduzz.com",
    futureIntegrations: ["pixel", "email"],
    guidanceNote: "Validar condições comerciais atuais antes de decidir.",
  },
  {
    id: "braip",
    name: "Braip",
    description: "Plataforma de afiliados e produtores digitais no BR.",
    category: "affiliate-network",
    useCases: ["afiliados", "produtos físicos digitais híbridos"],
    advantages: ["rede de afiliados", "checkout integrado"],
    limitations: ["qualidade variável de ofertas"],
    businessTypes: ["afiliado", "infoproduto", "e-commerce"],
    checkout: true,
    recurrence: false,
    affiliates: true,
    producer: true,
    api: false,
    documentation: "https://braip.com",
    futureIntegrations: ["tracking"],
    guidanceNote: "Revise políticas anti-spam e comissões em fonte oficial.",
  },
  {
    id: "herospark",
    name: "HeroSpark",
    description: "Plataforma de cursos e funis com foco em conversão.",
    category: "infoproduct",
    useCases: ["curso", "funil", "assinatura"],
    advantages: ["ferramentas de funil", "páginas"],
    limitations: ["dependência do ecossistema da marca"],
    businessTypes: ["curso", "infoproduto", "assinatura"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://herospark.com",
    futureIntegrations: ["crm"],
    guidanceNote: "Confirme features e preços em documentação atual.",
  },
  {
    id: "monetizze",
    name: "Monetizze",
    description: "Plataforma BR de afiliados e produtores.",
    category: "affiliate-network",
    useCases: ["afiliados", "produtos digitais"],
    advantages: ["programa de afiliados maduro"],
    limitations: ["concorrência em nichos saturados"],
    businessTypes: ["afiliado", "infoproduto"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: false,
    documentation: "https://monetizze.com.br",
    futureIntegrations: ["pixel"],
    guidanceNote: "Sempre validar comissão e cookie window atual.",
  },
  {
    id: "ticto",
    name: "Ticto",
    description: "Checkout e área de membros para infoprodutores BR.",
    category: "infoproduct",
    useCases: ["checkout", "assinatura", "afiliados"],
    advantages: ["setup ágil", "foco em conversão"],
    limitations: ["menos marketplace orgânico que Hotmart"],
    businessTypes: ["infoproduto", "curso", "assinatura"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://ticto.com.br",
    futureIntegrations: ["webhooks"],
    guidanceNote: "Compare com Kiwify/Hotmart via pesquisa atual.",
  },
  {
    id: "kirvano",
    name: "Kirvano",
    description: "Checkout e gestão de produtos digitais.",
    category: "infoproduct",
    useCases: ["checkout", "assinatura", "produtos digitais"],
    advantages: ["checkout BR", "foco em conversão"],
    limitations: ["ecossistema de afiliados menor que marketplaces maduros"],
    businessTypes: ["infoproduto", "assinatura", "curso"],
    checkout: true,
    recurrence: true,
    affiliates: true,
    producer: true,
    api: true,
    documentation: "https://kirvano.com",
    futureIntegrations: ["pixel", "crm"],
    guidanceNote: "Confirme taxas oficiais antes de migrar catálogo.",
  },
  {
    id: "gumroad",
    name: "Gumroad",
    description: "Marketplace global simples para creators e digital goods.",
    category: "creator-commerce",
    useCases: ["templates", "ebooks", "prompt packs", "assinatura light"],
    advantages: ["global", "setup rápido", "bom para creators"],
    limitations: ["menos stack BR de pagamento local"],
    businessTypes: ["template", "prompt-pack", "produto-digital", "creator"],
    checkout: true,
    recurrence: true,
    affiliates: false,
    producer: true,
    api: true,
    documentation: "https://gumroad.com",
    futureIntegrations: ["email"],
    guidanceNote: "Ver FX/taxas para vendas internacionais.",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Plataforma de e-commerce com loja própria e apps.",
    category: "ecommerce",
    useCases: ["loja online", "DTC", "assinatura de produtos"],
    advantages: ["ecossistema de apps", "controle de marca"],
    limitations: ["custo mensal + apps", "logística separada"],
    businessTypes: ["e-commerce", "loja-fisica", "assinatura"],
    checkout: true,
    recurrence: true,
    affiliates: false,
    producer: true,
    api: true,
    documentation: "https://shopify.com",
    futureIntegrations: ["erp", "ads"],
    guidanceNote: "Cust-to-serve depende de apps e frete — validar com números reais.",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "E-commerce open-source sobre WordPress.",
    category: "ecommerce",
    useCases: ["loja custom", "catálogo", "conteúdo + loja"],
    advantages: ["controle total", "plugins", "owned media"],
    limitations: ["manutenção técnica", "hospedagem e segurança"],
    businessTypes: ["e-commerce", "loja-fisica"],
    checkout: true,
    recurrence: true,
    affiliates: false,
    producer: true,
    api: true,
    documentation: "https://woocommerce.com",
    futureIntegrations: ["erp", "crm"],
    guidanceNote: "Ideal quando já há WordPress e capacidade técnica.",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Infraestrutura global de pagamentos e assinaturas.",
    category: "payments",
    useCases: ["SaaS", "assinatura", "checkout custom"],
    advantages: ["API forte", "subscriptions", "global"],
    limitations: ["disponibilidade/KYC por país", "dev effort"],
    businessTypes: ["saas", "assinatura", "app", "ferramenta-ia"],
    checkout: true,
    recurrence: true,
    affiliates: false,
    producer: true,
    api: true,
    documentation: "https://stripe.com/docs",
    futureIntegrations: ["billing-portal", "tax"],
    guidanceNote: "Confirme disponibilidade no seu país e taxas atuais.",
  },
  {
    id: "mercado-pago",
    name: "Mercado Pago",
    description: "Pagamentos e checkout populares na América Latina.",
    category: "payments",
    useCases: ["checkout BR/LATAM", "assinatura", "link de pagamento"],
    advantages: ["adoção local", "PIX", "confiança do consumidor"],
    limitations: ["disponibilidade de features avançadas vs Stripe"],
    businessTypes: ["e-commerce", "prestacao-de-servico", "infoproduto", "saas"],
    checkout: true,
    recurrence: true,
    affiliates: false,
    producer: true,
    api: true,
    documentation: "https://www.mercadopago.com.br/developers",
    futureIntegrations: ["pos", "wallet"],
    guidanceNote: "Compare split/taxas e chargeback policies atualizadas.",
  },
];

const byId = new Map(MARKETPLACE_REGISTRY.map((m) => [m.id, m] as const));

export function listMarketplaces(): MarketplaceRecord[] {
  return [...MARKETPLACE_REGISTRY];
}

export function getMarketplace(id: MarketplaceId): MarketplaceRecord | undefined {
  return byId.get(id);
}

export function marketplacesForBusinessType(
  type: MarketplaceRecord["businessTypes"][number]
): MarketplaceRecord[] {
  return MARKETPLACE_REGISTRY.filter((m) => m.businessTypes.includes(type));
}

export function marketplacesWithAffiliates(): MarketplaceRecord[] {
  return MARKETPLACE_REGISTRY.filter((m) => m.affiliates);
}

export function compareMarketplaces(
  a: MarketplaceId,
  b: MarketplaceId
): {
  a: MarketplaceRecord;
  b: MarketplaceRecord;
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  needsWebResearch: true;
  researchQuery: string;
} | null {
  const left = byId.get(a);
  const right = byId.get(b);
  if (!left || !right) return null;
  const shared: string[] = [];
  if (left.checkout && right.checkout) shared.push("checkout");
  if (left.recurrence && right.recurrence) shared.push("recorrência");
  if (left.affiliates && right.affiliates) shared.push("afiliados");
  if (left.producer && right.producer) shared.push("produtor");
  if (left.api && right.api) shared.push("API");
  return {
    a: left,
    b: right,
    shared,
    onlyA: left.advantages,
    onlyB: right.advantages,
    needsWebResearch: true,
    researchQuery: `${left.name} vs ${right.name} taxas afiliados checkout ${new Date().getFullYear()}`,
  };
}
