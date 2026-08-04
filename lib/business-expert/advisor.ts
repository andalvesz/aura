/**
 * Production advisor — Q&A over registries + context. No external invention.
 */

import {
  getSupportedBusinessType,
  listSupportedBusinessTypes,
} from "@/lib/business-expert/registry";
import { knowledgeByDomain } from "@/lib/business-expert/knowledge";
import {
  getMarketplace,
  listMarketplaces,
  marketplacesForBusinessType,
  marketplacesWithAffiliates,
} from "@/lib/business-expert/marketplaces";
import { listBusinessModes, recommendModes } from "@/lib/business-expert/modes";
import type {
  AdvisorRecommendation,
  AdvisorResult,
  BusinessContext,
  BusinessIntentKind,
  BusinessKnowledgeDomainId,
  BusinessModeId,
  MarketplaceId,
  SupportedBusinessType,
} from "@/lib/business-expert/types";
import { shouldPreferWebResearch } from "@/lib/business-expert/web-research-provider";

const HREF = "/dashboard/business-expert";

function nid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickTypes(ctx: BusinessContext): SupportedBusinessType[] {
  if (ctx.activeBusinessTypes.length) return ctx.activeBusinessTypes.slice(0, 3);
  if (ctx.profile.capital === "bootstrap" || ctx.profile.capital === "low") {
    return ["afiliado", "prestacao-de-servico", "infoproduto"];
  }
  if (ctx.profile.capital === "high" || ctx.profile.capital === "funded") {
    return ["saas", "marketplace", "e-commerce"];
  }
  return ["negocios-locais", "agencia", "assinatura"];
}

function platformsFor(types: SupportedBusinessType[]): MarketplaceId[] {
  const ids = new Set<MarketplaceId>();
  for (const t of types) {
    for (const m of marketplacesForBusinessType(t).slice(0, 2)) ids.add(m.id);
  }
  if (!ids.size) {
    for (const m of listMarketplaces().slice(0, 3)) ids.add(m.id);
  }
  return [...ids].slice(0, 4);
}

function recommendationsForIntent(
  intent: BusinessIntentKind,
  ctx: BusinessContext
): AdvisorRecommendation[] {
  const types = pickTypes(ctx);
  const recs: AdvisorRecommendation[] = [];
  const push = (
    domain: BusinessKnowledgeDomainId,
    title: string,
    rationale: string,
    nextSteps: string[],
    priority: AdvisorRecommendation["priority"] = "medium",
    kind: AdvisorRecommendation["kind"] = "general"
  ) => {
    recs.push({
      id: nid("rec"),
      title,
      rationale,
      domain,
      priority,
      nextSteps,
      relatedBusinessTypes: types,
      kind,
    });
  };

  switch (intent) {
    case "open_business":
    case "create_company":
      push("validacao", "Valide antes de formalizar", "Custo fixo cedo dói sem demanda.", ["Hipótese em 1 frase", "5 conversas", "Critério de tração"], "high", "business");
      push("financeiro", "Orçar CAPEX e 3 meses", `Capital: ${ctx.profile.capital}`, ["Custos fixos", "Floor de preço"], "high", "strategy");
      break;
    case "affiliate":
    case "sell_online":
      push("aquisicao", "Canal único de afiliação", "Volume sem nicho queima energia.", ["1 nicho", "1 plataforma", "10 peças"], "high", "strategy");
      push("oferta", "Só indique o que usaria", "Reputação é o ativo.", ["Escolher 1–3 produtos", "CTA claro"], "medium", "platform");
      break;
    case "create_product":
    case "create_course":
      push("oferta", "Promessa e produto mínimo", "Oferta clara vende antes do design.", ["Problem→promessa", "Módulos", "Preço"], "high", "product");
      push("validacao", "Pré-venda", "Dinheiro valida melhor que like.", ["Landing", "5 contatos quentes"], "high", "product");
      break;
    case "make_money":
    case "live_from_internet":
      push("monetizacao", "Primeira receita em ciclo curto", "Serviço ou afiliado ensina rápido.", ["Oferta de 7 dias", "10 convites"], "high", "business");
      push("vendas", "Conversas > estética", "Feche conversas simples.", ["Lista de contatos", "script"], "high", "strategy");
      break;
    case "validate_idea":
      push("validacao", "Teste 7–14 dias", "Evidência a priori.", ["Hipótese", "métrica", "kill switch"], "high", "strategy");
      break;
    case "platform_compare":
      push("monetizacao", "Compare com dados vivos", "Taxas mudam — use web research do Aura.", ["Listar critérios", "2 plataformas finalistas"], "high", "platform");
      break;
    case "build_offer":
      push("oferta", "Transformação + prazo + prova", "Oferta = clareza.", ["Escrever 1 parágrafo", "preço"], "high", "product");
      break;
    case "price_help":
      push("preco", "Ancore no resultado", "Barato demais atrai cliente errado.", ["Floor", "1 preço principal"], "high", "product");
      break;
    case "find_clients":
      push("aquisicao", "1 canal, meta semanal", "Dispersão mata.", ["Escolher canal", "ritual semanal"], "high", "strategy");
      break;
    case "grow":
    case "scale":
      push("growth", "Escale o que já converte", "Não escale hipótese.", ["Documentar funil", "1 experimento"], "high", "strategy");
      break;
    case "start_entrepreneurship":
      push("empreendedorismo", "Problema pago", "Empreender sem dor paga vira hobby.", ["3 dores", "priorizar"], "high", "business");
      break;
    default:
      push("validacao", "Próximo passo", "Complete perfil e escolha 1 foco.", ["Objetivo", "modo empresarial"], "medium", "general");
  }

  for (const domain of ctx.activeDomains.slice(0, 2)) {
    const articles = knowledgeByDomain(domain);
    if (articles[0]) {
      push(domain, articles[0].title, articles[0].summary, articles[0].bullets.slice(0, 2), "low");
    }
  }
  return recs.slice(0, 8);
}

function summarize(intent: BusinessIntentKind, ctx: BusinessContext): string {
  const types = pickTypes(ctx).map((t) => getSupportedBusinessType(t)?.name ?? t).join(", ");
  const modes = recommendModes({
    capital: ctx.profile.capital,
    prefersDigital: true,
    wantsLocal: intent === "open_business",
  })
    .map((m) => m.name)
    .join(", ");

  switch (intent) {
    case "platform_compare":
      return "Compare plataformas por checkout, afiliados, recorrência e público. Prefira pesquisa atualizada para taxas.";
    case "affiliate":
      return `Para afiliados, comece com nicho estreito e plataformas: ${marketplacesWithAffiliates()
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")}.`;
    case "create_product":
    case "create_course":
      return `Monte oferta com promessa clara. Tipos relacionados: ${types}. Modos: ${modes}.`;
    case "make_money":
    case "live_from_internet":
      return `Caminhos de receita mais curtos: ${types}. Use o Affiliate Assistant ou Product Builder conforme o modo.`;
    case "open_business":
      return `Para abrir negócio (digital ou local), valide demanda e caixa. Considerar modos: ${modes}.`;
    default:
      return `Business Expert B1.X: orientação empresarial offline + web research quando necessário. Sugestões: ${types}.`;
  }
}

export function adviseBusiness(
  intent: BusinessIntentKind,
  ctx: BusinessContext,
  message = ""
): AdvisorResult {
  const types = pickTypes(ctx);
  const recommendations = recommendationsForIntent(intent, ctx);
  const modes = recommendModes({
    capital: ctx.profile.capital,
    prefersDigital: true,
    wantsLocal: /local|cidade|restaurante|loja/i.test(message),
    wantsAudience: /creator|conte[uú]do|audi[eê]ncia/i.test(message),
  }).map((m) => m.id);

  const needsWeb =
    shouldPreferWebResearch(message) || intent === "platform_compare";
  const webQuery = needsWeb
    ? message.slice(0, 160) || "comparar plataformas checkout afiliados taxas"
    : null;

  return {
    intent,
    summary: summarize(intent, ctx),
    recommendations,
    suggestedDomains: [
      ...new Set([
        ...recommendations.map((r) => r.domain),
        ...ctx.activeDomains.slice(0, 3),
      ]),
    ],
    suggestedBusinessTypes: types,
    suggestedModes: modes.slice(0, 4) as BusinessModeId[],
    suggestedMarketplaces: platformsFor(types),
    missingInformation: [...ctx.gaps],
    limitations: [
      ...ctx.limitations,
      "Jurídico/impostos: orientação apenas",
      "Não inventa dados recentes de mercado",
    ],
    href: HREF,
    needsWebResearch: needsWeb,
    webResearchQuery: webQuery,
  };
}

export function formatAdvisorMessage(result: AdvisorResult): string {
  const lines = [
    result.summary,
    "",
    "Recomendações:",
    ...result.recommendations.slice(0, 5).map(
      (r, i) =>
        `${i + 1}. **${r.title}** (${r.domain}) — ${r.nextSteps[0] ?? r.rationale}`
    ),
  ];
  if (result.suggestedMarketplaces.length) {
    lines.push(
      "",
      `Plataformas a considerar: ${result.suggestedMarketplaces
        .map((id) => getMarketplace(id)?.name ?? id)
        .join(", ")}`
    );
  }
  if (result.suggestedModes.length) {
    lines.push(
      `Modos: ${result.suggestedModes
        .map((id) => listBusinessModes().find((m) => m.id === id)?.name ?? id)
        .join(", ")}`
    );
  }
  if (result.needsWebResearch) {
    lines.push(
      "",
      `🔎 Web research recomendada: ${result.webResearchQuery ?? "—"} (provider Aura; sem crawler no Expert)`
    );
  }
  lines.push("", `Business Expert: ${result.href}`);
  return lines.join("\n");
}

export function listSuggestedBusinessTypesForCapital(
  capital: BusinessContext["profile"]["capital"]
): SupportedBusinessType[] {
  return listSupportedBusinessTypes()
    .filter((t) => t.bestFitCapital.includes(capital) || capital === "unknown")
    .map((t) => t.id)
    .slice(0, 6);
}

export function answerBusinessQuestion(
  message: string,
  ctx: BusinessContext
): AdvisorResult {
  const m = message.toLowerCase();
  let intent: BusinessIntentKind = "advise";
  if (/plataforma|kiwify|hotmart|melhor\s+plataforma/.test(m)) intent = "platform_compare";
  else if (/afiliad/.test(m)) intent = "affiliate";
  else if (/criar\s+(um\s+)?curso|infoproduto/.test(m)) intent = "create_course";
  else if (/criar\s+(um\s+)?produto/.test(m)) intent = "create_product";
  else if (/oferta|cobrar|pre[cç]o/.test(m)) intent = /cobrar|pre[cç]o/.test(m) ? "price_help" : "build_offer";
  else if (/clientes?/.test(m)) intent = "find_clients";
  else if (/escalar|crescer/.test(m)) intent = /escalar/.test(m) ? "scale" : "grow";
  else if (/validar/.test(m)) intent = "validate_idea";
  else if (/saas/.test(m)) intent = "advise";
  else if (/ag[eê]ncia/.test(m)) intent = "advise";
  else if (/ganhar\s+dinheiro|viver\s+de\s+internet/.test(m)) intent = "make_money";
  return adviseBusiness(intent, ctx, message);
}
