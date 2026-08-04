/**
 * Comparisons, scenarios, discovery signals, recommendations for kernel integration.
 * Produces payloads usable by Decision/Scenario/Discovery/Recommendation — no forks.
 */

import {
  compareMarketplaces,
  getMarketplace,
  listMarketplaces,
} from "@/lib/business-expert/marketplaces";
import { listBusinessModes } from "@/lib/business-expert/modes";
import { listDigitalBusinesses } from "@/lib/business-expert/digital-catalog";
import type {
  BusinessComparisonResult,
  BusinessContext,
  BusinessOpportunitySignal,
  BusinessRecommendationCard,
  BusinessScenarioDraft,
  ComparisonPair,
} from "@/lib/business-expert/types";
import { requestBusinessWebResearch, shouldPreferWebResearch } from "@/lib/business-expert/web-research-provider";
import type { WebResearchRequest } from "@/lib/business-expert/types";

export function compareBusinessOptions(
  message: string
): BusinessComparisonResult | null {
  const m = message.toLowerCase();
  if (/kiwify/.test(m) && /hotmart/.test(m)) {
    const cmp = compareMarketplaces("kiwify", "hotmart");
    if (!cmp) return null;
    return {
      pair: "kiwify_vs_hotmart",
      label: "Kiwify x Hotmart",
      optionA: {
        name: cmp.a.name,
        pros: cmp.a.advantages,
        cons: cmp.a.limitations,
      },
      optionB: {
        name: cmp.b.name,
        pros: cmp.b.advantages,
        cons: cmp.b.limitations,
      },
      recommendation:
        "Se prioriza simplicidade BR e setup rápido, Kiwify costuma ser o primeiro teste; se prioriza rede de afiliados/marketplace, Hotmart entra forte — confirme taxas com pesquisa atual.",
      confidence: 62,
      needsFreshWebResearch: true,
      researchQuery: cmp.researchQuery,
    };
  }
  if (/afiliad/.test(m) && /(produto\s+pr[oó]prio|pr[oó]prio)/.test(m)) {
    return {
      pair: "affiliate_vs_own_product",
      label: "Afiliado x Produto Próprio",
      optionA: {
        name: "Afiliado",
        pros: ["baixo CAPEX", "velocidade", "aprende distribution"],
        cons: ["menor margem", "dependência de oferta de terceiros"],
      },
      optionB: {
        name: "Produto próprio",
        pros: ["controle", "margem", "ativo"],
        cons: ["mais lento", "exige validação e produção"],
      },
      recommendation:
        "Com pouco capital/tempo, afiliado primeiro; se já tem audiência e expertise, produto próprio com pré-venda.",
      confidence: 70,
      needsFreshWebResearch: false,
      researchQuery: null,
    };
  }
  if (/ag[eê]ncia/.test(m) && /saas/.test(m)) {
    return {
      pair: "agency_vs_saas",
      label: "Agência x SaaS",
      optionA: {
        name: "Agência",
        pros: ["receita mais cedo", "feedback humano"],
        cons: ["teto de tempo", "dependência de delivery"],
      },
      optionB: {
        name: "SaaS",
        pros: ["escala de margem", "produto repetível"],
        cons: ["mais capital/tempo", "churn e suporte"],
      },
      recommendation:
        "Se precisa de caixa agora → agência/serviço; se há problema recorrente pago e capacidade de produto → SaaS com MVP mínimo.",
      confidence: 68,
      needsFreshWebResearch: false,
      researchQuery: null,
    };
  }
  if (/loja/.test(m) && /e-?commerce|ecommerce/.test(m)) {
    return {
      pair: "store_vs_ecommerce",
      label: "Loja física x E-commerce",
      optionA: {
        name: "Loja física",
        pros: ["experiência", "confiança local"],
        cons: ["aluguel", "horário", "geografia"],
      },
      optionB: {
        name: "E-commerce",
        pros: ["alcance", "horário 24/7"],
        cons: ["CAC/logística", "concorrência de preço"],
      },
      recommendation:
        "Valide demanda local antes de CAPEX; e-commerce exige unit economics do pedido. Muitos começam hybrid (vitrine + whatsapp).",
      confidence: 66,
      needsFreshWebResearch: false,
      researchQuery: null,
    };
  }
  return null;
}

export function draftBusinessScenario(message: string): BusinessScenarioDraft | null {
  if (!/e\s+se\b|e\s+se\s+eu|what\s+if/i.test(message)) return null;
  const m = message.toLowerCase();
  let focus = "esta decisão empresarial";
  if (/afiliad/.test(m)) focus = "vender como afiliado";
  if (/saas/.test(m)) focus = "criar SaaS";
  if (/restaurante|hamburguer/.test(m)) focus = "abrir restaurante/food";

  return {
    prompt: message,
    branches: [
      {
        label: "Mais provável",
        impact: "MEDIUM",
        upside: `Aprendizado real em ${focus} em 30–60 dias`,
        downside: "Progresso lento se faltar consistência",
        nextStep: "Definir métrica go/no-go",
      },
      {
        label: "Melhor caso",
        impact: "HIGH",
        upside: "Tração e caixa mais cedo que o esperado",
        downside: "Pode esconder fragilidade operacional",
        nextStep: "Documentar o que funcionou",
      },
      {
        label: "Pior caso",
        impact: "HIGH",
        upside: "Corte cedo com pouco capital queimado",
        downside: "Zero tração e fadiga",
        nextStep: "Limitar investimento no teste",
      },
      {
        label: "Conservador",
        impact: "LOW",
        upside: "Risco controlado",
        downside: "Pode demorar a aprender",
        nextStep: "Teste mínimo em 14 dias",
      },
    ],
    forCoreScenario: true,
  };
}

export function detectBusinessOpportunities(
  ctx: BusinessContext
): BusinessOpportunitySignal[] {
  const out: BusinessOpportunitySignal[] = [];
  if (ctx.gaps.includes("no_ventures") || ctx.ventures.length === 0) {
    out.push({
      id: "opp_new_business",
      kind: "nova-oportunidade",
      title: "Espaço para iniciar um negócio",
      summary: "Nenhum venture ativo — afiliado, serviço ou MVP digital cabem no perfil.",
      confidence: 60,
    });
  }
  if (ctx.profile.capital === "bootstrap" || ctx.profile.capital === "low") {
    out.push({
      id: "opp_affiliate",
      kind: "novo-nicho",
      title: "Nicho via afiliados / serviço",
      summary: "Com capital baixo, distribuição e serviço geram aprendizado pago mais rápido.",
      confidence: 65,
    });
  }
  if (ctx.activeMode === "startup" || ctx.activeBusinessTypes.includes("saas")) {
    out.push({
      id: "opp_saas_market",
      kind: "novo-mercado",
      title: "Mercado de workflow recorrente",
      summary: "Busque dores semanais B2B com orçamento — base SaaS.",
      confidence: 58,
    });
  }
  const platforms = listMarketplaces().slice(0, 2);
  for (const p of platforms) {
    out.push({
      id: `opp_platform_${p.id}`,
      kind: "nova-plataforma",
      title: `Avaliar plataforma ${p.name}`,
      summary: p.description,
      confidence: 50,
    });
  }
  if (ctx.ventures.some((v) => v.status === "active")) {
    out.push({
      id: "opp_competitor_watch",
      kind: "novo-concorrente",
      title: "Monitorar concorrentes do venture ativo",
      summary: "Registre alternativas do cliente (sem inventar ranking atual).",
      confidence: 55,
    });
  }
  return out.slice(0, 6);
}

export function buildBusinessRecommendations(
  ctx: BusinessContext
): BusinessRecommendationCard[] {
  const cards: BusinessRecommendationCard[] = [
    {
      id: "rec_product",
      kind: "product",
      title: "Novo produto enxuto",
      summary: "Empacote 1 problema com 1 oferta e validade de 14 dias.",
      priority: "high",
      nextSteps: ["Product Builder", "pré-venda"],
    },
    {
      id: "rec_niche",
      kind: "niche",
      title: "Nicho mais estreito",
      summary: "Reduza público para aumentar conversão e prova social.",
      priority: "medium",
      nextSteps: ["reescrever ICP", "5 entrevistas"],
    },
    {
      id: "rec_business",
      kind: "business",
      title: "Novo negócio adjacente",
      summary: listBusinessModes()[0]
        ? `Considere modo ${listBusinessModes()[0].name} como adjacência`
        : "Explore modos empresariais",
      priority: "low",
      nextSteps: ["comparar modos", "cenário e se"],
    },
    {
      id: "rec_strategy",
      kind: "strategy",
      title: "Estratégia de aquisição única",
      summary: "Um canal bem medido vence 4 canais rasos.",
      priority: "high",
      nextSteps: ["escolher canal", "definir CPA teto"],
    },
    {
      id: "rec_platform",
      kind: "platform",
      title: "Plataforma principal",
      summary: getMarketplace("kiwify")
        ? "Defina checkout/afiliados principais (ex.: Kiwify/Hotmart/Stripe) e não disperse."
        : "Defina 1 plataforma de monetização.",
      priority: "medium",
      nextSteps: ["comparar 2 plataformas", "web research se taxas importarem"],
    },
  ];

  if (ctx.activeMode === "afiliado") {
    cards.unshift({
      id: "rec_aff",
      kind: "strategy",
      title: "Rotina de afiliado",
      summary: "10 peças/semana + 1 CTA claro.",
      priority: "high",
      nextSteps: ["Affiliate Assistant"],
    });
  }

  return cards.slice(0, 6);
}

export function maybeWebResearchForMessage(
  message: string
): WebResearchRequest | null {
  if (!shouldPreferWebResearch(message)) return null;
  return requestBusinessWebResearch({
    query: message.slice(0, 180),
    reason: "Comparação ou dado sensível ao tempo (taxas/plataforma)",
    required: true,
  });
}

export function formatComparisonMessage(c: BusinessComparisonResult): string {
  return [
    `Comparação: ${c.label}`,
    "",
    `${c.optionA.name}: + ${c.optionA.pros.join("; ")} · − ${c.optionA.cons.join("; ")}`,
    `${c.optionB.name}: + ${c.optionB.pros.join("; ")} · − ${c.optionB.cons.join("; ")}`,
    "",
    c.recommendation,
    c.needsFreshWebResearch
      ? `\n⚠️ Prefira pesquisa atualizada: ${c.researchQuery}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// silence unused type warning
export type _Cmp = ComparisonPair;
export type _DigitalHint = ReturnType<typeof listDigitalBusinesses>;
