/**
 * Expanded offline knowledge articles (B1.X).
 */

import type {
  BusinessKnowledgeDomainId,
  KnowledgeArticle,
  SupportedBusinessType,
} from "@/lib/business-expert/types";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "kn-mercado-01",
    domain: "mercado",
    title: "Segmento antes de escala",
    summary: "Mercados amplos parecem grandes; segmentos específicos convertem primeiro.",
    bullets: [
      "Defina o cliente ideal em 1 frase.",
      "Liste 3 alternativas que ele já usa.",
      "Meça vontade de pagar, não só interesse.",
    ],
    relatedBusinessTypes: ["saas", "produto-digital", "negocios-locais"],
    source: "builtin",
  },
  {
    id: "kn-empreendedorismo-01",
    domain: "empreendedorismo",
    title: "Problema pago antes de sonho grande",
    summary: "Empreender começa em dor com orçamento, não em ideia bonita.",
    bullets: [
      "Liste dores que você já observa.",
      "Priorize urgência + orçamento.",
      "Escolha 1 caminho por 30 dias.",
    ],
    relatedBusinessTypes: ["prestacao-de-servico", "infoproduto", "agencia"],
    source: "builtin",
  },
  {
    id: "kn-modelo-01",
    domain: "modelos-de-negocio",
    title: "Motor de receita explícito",
    summary: "Sem motor de receita explícito, há hobby — não negócio.",
    bullets: [
      "Identifique quem paga (usuário ≠ pagador).",
      "Escolha 1 modelo primário antes de misturar.",
      "Descreva a unidade de valor cobrada.",
    ],
    relatedBusinessTypes: ["assinatura", "marketplace", "agencia"],
    source: "builtin",
  },
  {
    id: "kn-produto-01",
    domain: "produto",
    title: "MVP que prova valor",
    summary: "O MVP existe para aprender, não para impressionar.",
    bullets: [
      "Corte features que não testam a hipótese central.",
      "Entregue valor em menos de 1 semana se possível.",
      "Documente o que o usuário completa sozinho.",
    ],
    relatedBusinessTypes: ["produto-digital", "saas", "curso"],
    source: "builtin",
  },
  {
    id: "kn-marketing-01",
    domain: "marketing",
    title: "Um canal bem-feito",
    summary: "Distribuição fraca mata produto bom.",
    bullets: [
      "Escolha 1 canal onde o cliente já está.",
      "Mensagem = dor + resultado + prova mínima.",
      "Meça custo por lead antes de ampliar.",
    ],
    relatedBusinessTypes: ["afiliado", "e-commerce", "creator"],
    source: "builtin",
  },
  {
    id: "kn-vendas-01",
    domain: "vendas",
    title: "Oferta simples, próximo passo claro",
    summary: "Vendas é conversão de confiança em compromisso.",
    bullets: [
      "Tenha 1 oferta principal e 1 upsell opcional.",
      "Defina o próximo passo em cada conversa.",
      "Trate objeções com prova, não desconto automático.",
    ],
    relatedBusinessTypes: ["consultoria", "mentoria", "agencia"],
    source: "builtin",
  },
  {
    id: "kn-growth-01",
    domain: "growth",
    title: "Loops antes de spend",
    summary: "Growth sustentável combina aquisição com retenção.",
    bullets: [
      "Métrica norte clara.",
      "Experimentos semanal com critério de kill.",
      "Não escale canal ainda frágil.",
    ],
    relatedBusinessTypes: ["saas", "assinatura", "marketplace"],
    source: "builtin",
  },
  {
    id: "kn-financeiro-01",
    domain: "financeiro",
    title: "Caixa e margem primeiro",
    summary: "Crescimento sem caixa é risco disfarçado.",
    bullets: [
      "Contribuição por venda/serviço.",
      "Custo fixo vs variável.",
      "Floor de preço.",
    ],
    relatedBusinessTypes: ["e-commerce", "saas", "loja-fisica"],
    source: "builtin",
  },
  {
    id: "kn-operacao-01",
    domain: "operacao",
    title: "Entrega repetível",
    summary: "Operação frágil impede crescimento saudável.",
    bullets: [
      "Checklist padrão.",
      "Capacidade máxima sem perder qualidade.",
      "Onde o fundador ainda é gargalo.",
    ],
    relatedBusinessTypes: ["loja-fisica", "prestacao-de-servico", "agencia"],
    source: "builtin",
  },
  {
    id: "kn-escala-01",
    domain: "escala",
    title: "Escale o que já funciona",
    summary: "Escalar processo não validado multiplica desperdício.",
    bullets: [
      "Prove unit economics.",
      "Documente o que converte.",
      "Automatize só o estável.",
    ],
    relatedBusinessTypes: ["saas", "marketplace", "assinatura"],
    source: "builtin",
  },
  {
    id: "kn-juridico-01",
    domain: "juridico",
    title: "Orientação: formalização e contratos (não é assessoria jurídica)",
    summary:
      "Orienta pontos a discutir com profissional — não substitui advogado.",
    bullets: [
      "Contratos claros de entrega e cancelamento.",
      "Uso de marca e direitos autorais em conteúdo.",
      "Consulte profissional antes de abrir empresa/franquia.",
    ],
    relatedBusinessTypes: ["agencia", "saas", "negocios-locais"],
    source: "builtin",
  },
  {
    id: "kn-impostos-01",
    domain: "impostos",
    title: "Orientação: impostos e regime (não é assessoria contábil)",
    summary:
      "Lembretes gerais; decisões fiscais exigem contador habilitado.",
    bullets: [
      "Separe pessoa física e fluxo do negócio cedo.",
      "Registre entradas e custos com comprovantes.",
      "Não defina regime tributário sem contador.",
    ],
    relatedBusinessTypes: ["prestacao-de-servico", "e-commerce", "loja-fisica"],
    source: "builtin",
  },
  {
    id: "kn-validacao-01",
    domain: "validacao",
    title: "Teste barato, evidência real",
    summary: "Validação é comportamento com compromisso, não likes.",
    bullets: [
      "Hipótese em 1 frase.",
      "Critério de sucesso a priori.",
      "Prefira dinheiro, tempo ou agenda marcada.",
    ],
    relatedBusinessTypes: ["produto-digital", "saas", "afiliado"],
    source: "builtin",
  },
  {
    id: "kn-concorrencia-01",
    domain: "concorrencia",
    title: "Concorrência como mapa, não paralisia",
    summary: "Estude alternativas reais do cliente, não só marcas famosas.",
    bullets: [
      "Liste 5 alternativas (incluindo 'não fazer nada').",
      "Compare promessa e preço",
      "Ache ângulo de diferenciação observável.",
    ],
    relatedBusinessTypes: ["saas", "agencia", "e-commerce"],
    source: "builtin",
  },
  {
    id: "kn-posicionamento-01",
    domain: "posicionamento",
    title: "Para quem, contra o quê",
    summary: "Posicionamento claro reduz CAC e encurta venda.",
    bullets: [
      "Público específico",
      "Problema específico",
      "Prova específica",
    ],
    relatedBusinessTypes: ["consultoria", "creator", "saas"],
    source: "builtin",
  },
  {
    id: "kn-oferta-01",
    domain: "oferta",
    title: "Oferta irrecusável com escopo honesto",
    summary: "Oferta = transformação + prazo + prova + preço.",
    bullets: [
      "Resultado em linguagem do cliente.",
      "O que inclui e o que não inclui.",
      "Risco reverso só se sustentável.",
    ],
    relatedBusinessTypes: ["curso", "mentoria", "agencia"],
    source: "builtin",
  },
  {
    id: "kn-preco-01",
    domain: "preco",
    title: "Preço comunica valor",
    summary: "Preço baixo demais atrai cliente errado.",
    bullets: [
      "Ancore no resultado.",
      "Comece com 1 preço principal.",
      "Revise após 5–10 vendas reais.",
    ],
    relatedBusinessTypes: ["infoproduto", "consultoria", "saas"],
    source: "builtin",
  },
  {
    id: "kn-branding-01",
    domain: "branding",
    title: "Marca como consistência",
    summary: "Branding não é logo; é memória de promessa cumprida.",
    bullets: [
      "Tom de voz simples",
      "Prova recorrente",
      "Nome e visual coerentes",
    ],
    relatedBusinessTypes: ["creator", "agencia", "e-commerce"],
    source: "builtin",
  },
  {
    id: "kn-aquisicao-01",
    domain: "aquisicao",
    title: "Aquisição mensurável",
    summary: "Canal sem métrica vira despesa.",
    bullets: [
      "1 canal primário",
      "CPA e LTV estimados",
      "Kill switch se não aprender",
    ],
    relatedBusinessTypes: ["afiliado", "saas", "e-commerce"],
    source: "builtin",
  },
  {
    id: "kn-retencao-01",
    domain: "retencao",
    title: "Retenção vale mais que hype",
    summary: "Crescer sem reter é encher balde furado.",
    bullets: [
      "Onboarding com aha moment",
      "Rituais semanais",
      "Ouça cancelamentos",
    ],
    relatedBusinessTypes: ["saas", "assinatura", "comunidade", "membership"],
    source: "builtin",
  },
  {
    id: "kn-monetizacao-01",
    domain: "monetizacao",
    title: "Primeira receita ensina",
    summary: "Monetização cedo gera aprendizado real de mercado.",
    bullets: [
      "Oferta de ciclo curto",
      "Cobrar mesmo no piloto",
      "Registrar objeções",
    ],
    relatedBusinessTypes: ["mentoria", "afiliado", "prestacao-de-servico"],
    source: "builtin",
  },
  {
    id: "kn-afiliado-01",
    domain: "vendas",
    title: "Afiliado: confiança > volume cego",
    summary: "Só indique o que usaria — reputação é o ativo.",
    bullets: [
      "Nicho estreito",
      "1 plataforma principal",
      "Conteúdo útil antes do pitch",
    ],
    relatedBusinessTypes: ["afiliado", "creator"],
    source: "builtin",
    packId: "affiliate-pack",
  },
  {
    id: "kn-kiwify-01",
    domain: "monetizacao",
    title: "Kiwify — quando faz sentido",
    summary: "Bom para produtor BR que quer checkout + afiliados rápidos.",
    bullets: [
      "Use se público principal for BR",
      "Configure afiliados e pixels",
      "Compare taxas com Hotmart via pesquisa atual",
    ],
    relatedBusinessTypes: ["infoproduto", "curso", "afiliado"],
    source: "builtin",
    packId: "kiwify-pack",
  },
  {
    id: "kn-hotmart-01",
    domain: "monetizacao",
    title: "Hotmart — quando faz sentido",
    summary: "Forte quando quer alcance de afiliados e marketplace.",
    bullets: [
      "Avalie competição no marketplace",
      "Programa de afiliados é o superpoder",
      "Confirme taxas e políticas oficiais",
    ],
    relatedBusinessTypes: ["curso", "infoproduto", "afiliado"],
    source: "builtin",
    packId: "hotmart-pack",
  },
  {
    id: "kn-saas-01",
    domain: "produto",
    title: "SaaS: problema recorrente pago",
    summary: "Sem uso recorrente, assinatura morre no churn.",
    bullets: [
      "Workflow que acontece semanalmente",
      "MVP manual se possível",
      "Métrica de ativação em 7 dias",
    ],
    relatedBusinessTypes: ["saas", "app", "ferramenta-ia"],
    source: "builtin",
    packId: "saas-pack",
  },
  {
    id: "kn-local-01",
    domain: "operacao",
    title: "Negócio local: demanda no raio",
    summary: "Valide se existem  clientes pagantes a 2–5 km.",
    bullets: [
      "Mapeie concorrentes a pé/carro",
      "Teste oferta em feira/popup",
      "Calcule aluguel vs margem",
    ],
    relatedBusinessTypes: ["negocios-locais", "loja-fisica"],
    source: "builtin",
    packId: "local-business-pack",
  },
];

export function listKnowledgeArticles(): KnowledgeArticle[] {
  return [...KNOWLEDGE_ARTICLES];
}

export function getKnowledgeArticle(id: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find((a) => a.id === id);
}

export function knowledgeByDomain(
  domain: BusinessKnowledgeDomainId
): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter((a) => a.domain === domain);
}

export function knowledgeForBusinessType(
  type: SupportedBusinessType
): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter((a) => a.relatedBusinessTypes.includes(type));
}

export function knowledgeCoverageSummary(): {
  domains: number;
  articles: number;
  coveredDomains: BusinessKnowledgeDomainId[];
} {
  const covered = new Set(KNOWLEDGE_ARTICLES.map((a) => a.domain));
  return {
    domains: covered.size,
    articles: KNOWLEDGE_ARTICLES.length,
    coveredDomains: [...covered],
  };
}
