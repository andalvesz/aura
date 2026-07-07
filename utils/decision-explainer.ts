import type {
  BusinessReasoningSummary,
  OpportunityComparisonEntry,
  OpportunityRecommendation,
  ParsedGoal,
  RecommendationSummary,
} from "@/lib/opportunity/opportunity-types";
import { BUSINESS_MODELS } from "@/utils/business-reasoning";

type ExplainContext = {
  rank: number;
  total: number;
  goal: ParsedGoal;
  reasoning: BusinessReasoningSummary;
  all: OpportunityRecommendation[];
};

const RECURRING_MODELS = new Set(["Comunidade", "Assinatura", "SaaS", "Ferramenta IA"]);

function modelMeta(label: string) {
  return BUSINESS_MODELS.find((m) => m.label === label);
}

function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function isRecurringModel(model: string): boolean {
  return RECURRING_MODELS.has(model);
}

function buildCompetitiveAdvantages(rec: OpportunityRecommendation): string[] {
  const advantages: string[] = [];

  if (isRecurringModel(rec.businessModel)) {
    advantages.push("Maior potencial de recorrência e previsibilidade de receita");
  }
  if (rec.opportunityScore.margin >= 75) {
    advantages.push("Margem operacional acima da média do ranking");
  }
  if (rec.opportunityScore.scalability >= 80) {
    advantages.push("Maior potencial de escala sem aumento linear de custo");
  }
  if (rec.opportunityScore.launchSpeed >= 75) {
    advantages.push("Lançamento mais rápido que alternativas de ticket similar");
  }
  if (rec.intentMatchScore >= 60) {
    advantages.push("Forte alinhamento com a intenção declarada pelo usuário");
  }
  if (rec.uniquenessScore >= 70) {
    advantages.push("Diferenciação percebida acima das outras opções");
  }
  if (advantages.length === 0) {
    advantages.push("Melhor equilíbrio entre score total e fit com o objetivo financeiro");
  }

  return advantages.slice(0, 4);
}

function buildRisks(rec: OpportunityRecommendation): string[] {
  const risks: string[] = [];

  if (rec.opportunityScore.competition < 50) {
    risks.push("Mercado competitivo — exige posicionamento claro para não virar commodity");
  }
  if (rec.uniquenessScore < 55) {
    risks.push("Pouca diferenciação percebida frente a soluções similares");
  }
  if (rec.investmentScore < 50) {
    risks.push("Investimento inicial ou complexidade de entrega acima da média");
  }
  if (rec.businessModel === "Agência" || rec.businessModel === "Consultoria") {
    risks.push("Modelo depende de capacidade de entrega — difícil escalar sem equipe");
  }
  if (rec.businessModel === "SaaS" || rec.businessModel === "Marketplace") {
    risks.push("Ciclo de validação mais longo e custo técnico antes da primeira venda");
  }
  if (rec.confidence < 50) {
    risks.push("Interpretação da intenção com confidence moderada — validar hipóteses cedo");
  }
  if (risks.length === 0) {
    risks.push("Risco principal: não validar com clientes reais antes de escalar produção");
  }

  return risks.slice(0, 4);
}

function buildAssumptions(rec: OpportunityRecommendation, reasoning: BusinessReasoningSummary): string[] {
  const assumptions: string[] = [
    `O avatar (${rec.avatar}) reconhece "${rec.problem}" como prioridade e paga para resolver`,
    `Ticket de ${formatBrl(rec.price)} é aceitável para ${reasoning.market ?? "o mercado alvo"}`,
  ];

  if (reasoning.technology) {
    assumptions.push(`O mercado está pronto para adotar ${reasoning.technology} como alavanca`);
  }
  if (isRecurringModel(rec.businessModel)) {
    assumptions.push("Há potencial de retenção por pelo menos 3–6 meses (LTV > CAC)");
  }
  if (reasoning.financialGoal.monthlyRevenue > 15000) {
    assumptions.push("Meta financeira exige volume ou ticket alto — uma das duas precisa se confirmar");
  }

  return assumptions.slice(0, 4);
}

function buildFirstMvp(rec: OpportunityRecommendation): string {
  const mvpByModel: Record<string, string> = {
    Curso: `Mini-curso com 3 aulas gravadas + 1 checklist aplicando "${rec.problem}" para ${rec.avatar}`,
    Mentoria: `Programa piloto de 4 semanas com 5 vagas para ${rec.avatar} atacando "${rec.problem}"`,
    Comunidade: `Grupo fechado com onboarding, 1 live semanal e biblioteca mínima sobre "${rec.problem}"`,
    Kit: `Pacote enxuto (PDF + templates) que resolve 80% de "${rec.problem}" em até 7 dias`,
    Templates: `5 templates prontos + vídeo de 15 min mostrando aplicação em "${rec.problem}"`,
    Consultoria: `Diagnóstico pago de 90 min + plano de ação de 30 dias para "${rec.problem}"`,
    Serviço: `Entrega pontual do resultado prometido para 3 clientes beta em "${rec.niche}"`,
    Agência: `Setup de campanha/funil mínimo por 30 dias para validar aquisição em "${rec.niche}"`,
    SaaS: `Protótipo no-code ou landing + waitlist com demo gravada do fluxo principal`,
    Automação: `1 fluxo automatizado ponta a ponta que elimina o gargalo de "${rec.problem}"`,
    Assinatura: `Plano mensal enxuto com 1 entrega recorrente clara (conteúdo, suporte ou ferramenta)`,
    Licenciamento: `Método documentado + 1 parceiro piloto usando sua marca/processo`,
    Marketplace: `Lista curada + conexão manual entre oferta e demanda em um nicho restrito`,
    "Ferramenta IA": `Assistente IA com 1 caso de uso focado: "${rec.problem}" para ${rec.avatar}`,
  };

  return mvpByModel[rec.businessModel] ?? `MVP mínimo que prova resolução de "${rec.problem}" em 2 semanas`;
}

function buildFirstSalePlan(rec: OpportunityRecommendation, reasoning: BusinessReasoningSummary): string {
  const audience = reasoning.avatar ?? rec.avatar;
  return (
    `Oferecer ${rec.recommendedProduct} a 10–20 ${audience} via mensagem direta ou rede próxima. ` +
    `Proposta: resolver "${rec.problem}" por ${formatBrl(rec.price)} com entrega do MVP em até ` +
    `${rec.estimatedValidationTime}. Meta: 3 vendas pagas para validar disposição real de compra.`
  );
}

function estimateInvestment(rec: OpportunityRecommendation): number {
  const meta = modelMeta(rec.businessModel);
  const launchDays = meta?.launchDays ?? 30;
  const base = meta?.ticketRange.min ?? 97;

  let investment = 1500;
  if (rec.businessModel === "SaaS" || rec.businessModel === "Marketplace") investment = 12000;
  else if (rec.businessModel === "Agência" || rec.businessModel === "Consultoria") investment = 4000;
  else if (rec.businessModel === "Curso") investment = 6000;
  else if (rec.businessModel === "Mentoria") investment = 2500;
  else if (rec.businessModel === "Templates" || rec.businessModel === "Kit") investment = 1200;

  investment += launchDays * 40;
  investment += Math.max(0, 200 - base);

  return Math.round(investment / 100) * 100;
}

function estimateValidationTime(rec: OpportunityRecommendation): string {
  const meta = modelMeta(rec.businessModel);
  const days = meta?.launchDays ?? 30;

  if (days <= 14) return "7–14 dias";
  if (days <= 30) return "14–30 dias";
  if (days <= 60) return "30–60 dias";
  return "60–90 dias";
}

function buildDecisionExplanation(rec: OpportunityRecommendation, ctx: ExplainContext): string {
  const { rank, all, reasoning } = ctx;
  const parts: string[] = [];

  if (rank === 1) {
    parts.push(
      `Esta opção ficou em 1º lugar porque combina o melhor score total (${Math.round(rec.opportunityScore.total)}) ` +
        `com modelo ${rec.businessModel} adequado para "${rec.problem}".`
    );
    const second = all[1];
    if (second) {
      const delta = Math.round(rec.opportunityScore.total - second.opportunityScore.total);
      parts.push(
        `Supera a Opção 2 em ${delta} pontos e oferece ${isRecurringModel(rec.businessModel) ? "maior recorrência" : "melhor equilíbrio risco/retorno"} ` +
          `frente a ${second.businessModel}.`
      );
    }
  } else if (rank === 2) {
    parts.push(
      `Opção 2 é uma alternativa sólida: ${rec.businessModel} ataca "${rec.problem}" com score ${Math.round(rec.opportunityScore.total)}.`
    );
    const first = all[0];
    if (first && modelMeta(rec.businessModel)?.launchDays! < (modelMeta(first.businessModel)?.launchDays ?? 99)) {
      parts.push("Mais rápida para validar que a Opção 1, porém com menor potencial de escala ou LTV.");
    } else {
      parts.push("Boa segunda escolha se a Opção 1 não converter na validação inicial.");
    }
  } else {
    parts.push(
      `Opção 3 ranqueia abaixo porque score ${Math.round(rec.opportunityScore.total)} ` +
        `e menor fit imediato com o objetivo de ${formatBrl(reasoning.financialGoal.monthlyRevenue)}/mês.`
    );
    parts.push("Não é a prioridade agora — considere apenas se as duas primeiras falharem na validação.");
  }

  return parts.join(" ");
}

export function enrichRecommendationWithDecision(
  rec: OpportunityRecommendation,
  ctx: ExplainContext
): OpportunityRecommendation {
  const estimatedInvestment = estimateInvestment(rec);
  const estimatedValidationTime = estimateValidationTime(rec);

  return {
    ...rec,
    decisionExplanation: buildDecisionExplanation(rec, ctx),
    competitiveAdvantages: buildCompetitiveAdvantages(rec),
    risks: buildRisks(rec),
    assumptions: buildAssumptions(rec, ctx.reasoning),
    firstMvp: buildFirstMvp(rec),
    firstSalePlan: buildFirstSalePlan(rec, ctx.reasoning),
    estimatedInvestment,
    estimatedValidationTime,
  };
}

export function buildTopThreeComparison(
  recommendations: OpportunityRecommendation[]
): OpportunityComparisonEntry[] {
  return recommendations.slice(0, 3).map((rec, index) => {
    const rank = index + 1;
    let label: OpportunityComparisonEntry["label"] = "alternativa";
    let verdict = "";
    const highlights: string[] = [];

    if (rank === 1) {
      label = "recomendada";
      verdict = "Vence porque possui o melhor equilíbrio entre score, modelo e fit com o objetivo.";
      if (isRecurringModel(rec.businessModel)) highlights.push("Maior recorrência");
      if (rec.opportunityScore.margin >= 75) highlights.push("Maior margem");
      if (rec.opportunityScore.scalability >= 80) highlights.push("Maior potencial de escala");
      if (highlights.length === 0) highlights.push("Melhor score total", "Maior alinhamento com a intenção");
    } else if (rank === 2) {
      label = "alternativa";
      verdict = "Boa alternativa — válida se a Opção 1 não converter na validação.";
      if (rec.opportunityScore.launchSpeed >= 75) highlights.push("Mais rápida para lançar");
      if (rec.estimatedInvestment < (recommendations[0]?.estimatedInvestment ?? Infinity)) {
        highlights.push("Menor investimento inicial");
      }
      highlights.push("Porém menor LTV ou escala que a Opção 1");
    } else {
      label = "evitar";
      verdict = "Não recomendada neste momento — ranqueada abaixo nas premissas atuais.";
      if (rec.opportunityScore.competition < 50) highlights.push("Mercado competitivo");
      if (rec.uniquenessScore < 55) highlights.push("Pouca diferenciação");
      if (highlights.length < 2) highlights.push("Menor score combinado", "Priorize as duas primeiras");
    }

    return {
      rank,
      title: rec.title,
      businessModel: rec.businessModel,
      verdict,
      highlights: highlights.slice(0, 3),
      label,
    };
  });
}

export function buildRecommendationSummary(
  recommendations: OpportunityRecommendation[],
  comparison: OpportunityComparisonEntry[]
): RecommendationSummary {
  const first = recommendations[0];
  const second = recommendations[1];
  const third = recommendations[2];
  const top = comparison[0];

  if (!first || !top) {
    return {
      recommendedOption: 1,
      recommendedTitle: "—",
      narrative: "Sem oportunidades suficientes para recomendar.",
      reasons: [],
      optionYCondition: "",
      avoidOptionZ: "",
    };
  }

  const reasons = top.highlights.length > 0 ? top.highlights : buildCompetitiveAdvantages(first).slice(0, 3);

  const optionY = second
    ? `Só partiria para a Opção 2 (${second.businessModel}) se a Opção 1 não fechar 3 vendas em ${first.estimatedValidationTime}.`
    : "Não há Opção 2 clara neste ranking.";

  const avoidZ = third
    ? `Evitaria a Opção 3 (${third.businessModel}) porque ${comparison[2]?.highlights.join(", ").toLowerCase() ?? "ranqueia abaixo no score e no fit atual"}.`
    : "";

  const narrative =
    `Se eu estivesse começando hoje, investiria primeiro na Opção 1: ${first.businessModel} para "${first.problem}". ` +
    `Motivos: ${reasons.join("; ")}. ${optionY} ${avoidZ}`.trim();

  return {
    recommendedOption: 1,
    recommendedTitle: first.title,
    narrative,
    reasons,
    optionYCondition: optionY,
    avoidOptionZ: avoidZ,
  };
}

export function enrichOpportunityResults(
  recommendations: OpportunityRecommendation[],
  goal: ParsedGoal,
  reasoning: BusinessReasoningSummary
): {
  recommendations: OpportunityRecommendation[];
  comparison: OpportunityComparisonEntry[];
  recommendationSummary: RecommendationSummary;
} {
  const enriched = recommendations.map((rec, index) =>
    enrichRecommendationWithDecision(rec, {
      rank: index + 1,
      total: recommendations.length,
      goal,
      reasoning,
      all: recommendations,
    })
  );

  const comparison = buildTopThreeComparison(enriched);
  const recommendationSummary = buildRecommendationSummary(enriched, comparison);

  return { recommendations: enriched, comparison, recommendationSummary };
}

/** Defaults for tests and fallbacks */
export function defaultDecisionFields(): Pick<
  OpportunityRecommendation,
  | "decisionExplanation"
  | "competitiveAdvantages"
  | "risks"
  | "assumptions"
  | "firstMvp"
  | "firstSalePlan"
  | "estimatedInvestment"
  | "estimatedValidationTime"
> {
  return {
    decisionExplanation: "Oportunidade ranqueada pelo motor de negócios.",
    competitiveAdvantages: ["Fit com o objetivo financeiro"],
    risks: ["Validar com clientes reais antes de escalar"],
    assumptions: ["Mercado disposto a pagar pelo ticket sugerido"],
    firstMvp: "MVP mínimo em 2 semanas",
    firstSalePlan: "10 conversas diretas com o avatar ideal",
    estimatedInvestment: 3000,
    estimatedValidationTime: "14–30 dias",
  };
}
