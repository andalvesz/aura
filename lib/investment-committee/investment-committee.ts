import { buildProductBuildBrief } from "@/utils/product-build-brief";
import {
  computeInvestmentScore,
  INVESTMENT_APPROVAL_THRESHOLD,
  isInvestmentApproved,
  isSpecialistApproved,
  scoreCeo,
  scoreCmo,
  scoreCopyChief,
  scorePerformanceManager,
  scoreProductSpecialist,
  SPECIALIST_MIN_APPROVAL,
} from "@/lib/investment-committee/investment-committee-score";
import type {
  InvestmentCommitteeInput,
  InvestmentCommitteeReport,
  InvestmentSpecialistName,
  InvestmentSpecialistReview,
} from "@/lib/investment-committee/investment-committee-types";

export {
  INVESTMENT_APPROVAL_THRESHOLD,
  SPECIALIST_MIN_APPROVAL,
} from "@/lib/investment-committee/investment-committee-score";

const REJECTION_MESSAGE = "Não recomendo investir dinheiro nesta missão.";

type SpecialistConfig = {
  name: InvestmentSpecialistName;
  score: number;
  analyze: () => { strengths: string[]; weaknesses: string[]; recommendation: string };
};

function buildStrength(score: number, label: string): string | null {
  if (score >= 85) return `${label} sólido (${Math.round(score)}/100).`;
  if (score >= 75) return `${label} adequado (${Math.round(score)}/100).`;
  return null;
}

function buildWeakness(score: number, label: string, threshold = SPECIALIST_MIN_APPROVAL): string | null {
  if (score < threshold) return `${label} abaixo do patamar (${Math.round(score)}/100).`;
  if (score < 85) return `${label} com margem de melhoria (${Math.round(score)}/100).`;
  return null;
}

function analyzeCeo(score: number, input: InvestmentCommitteeInput): Omit<InvestmentSpecialistReview, "name" | "score" | "approved"> {
  const { meta } = input;
  const brief = input.productBuildBrief ?? null;
  const opportunity = meta.selected_opportunity;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const s1 = buildStrength(brief?.opportunity_score ?? opportunity?.opportunityScore.total ?? 0, "Potencial de oportunidade");
  const s2 = buildStrength(brief?.validation_score ?? meta.validation_score ?? 0, "Validação de mercado");
  const s3 = buildStrength(opportunity?.estimatedProfit ? Math.min(100, opportunity.estimatedProfit / 200) : 0, "Potencial de lucro");
  const s4 = buildStrength(opportunity?.uniquenessScore ?? 0, "Posicionamento diferenciado");
  if (s1) strengths.push(s1);
  if (s2) strengths.push(s2);
  if (s3) strengths.push(s3);
  if (s4) strengths.push(s4);

  const w1 = buildWeakness(brief?.opportunity_score ?? opportunity?.opportunityScore.total ?? 0, "Oportunidade");
  const w2 = buildWeakness(brief?.validation_score ?? meta.validation_score ?? 0, "Validação");
  const w3 = buildWeakness(brief?.margin ?? opportunity?.opportunityScore.margin ?? 0, "Margem");
  if (w1) weaknesses.push(w1);
  if (w2) weaknesses.push(w2);
  if (w3) weaknesses.push(w3);

  const recommendation = isSpecialistApproved(score)
    ? "Estratégia e mercado sustentam investimento."
    : "Revisar oportunidade, margem e posicionamento antes de investir.";

  return {
    strengths: strengths.length > 0 ? strengths : ["Base estratégica aceitável."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Sem fraquezas críticas identificadas."],
    recommendation,
  };
}

function analyzeCmo(score: number, input: InvestmentCommitteeInput): Omit<InvestmentSpecialistReview, "name" | "score" | "approved"> {
  const { salesPackage } = input;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [label, value, ready] of [
    ["Oferta", salesPackage.offer.score, salesPackage.offer.ready],
    ["Funil (landing + checkout)", avg(salesPackage.landing.score, salesPackage.checkout.score), salesPackage.landing.ready && salesPackage.checkout.ready],
    ["Diferenciação", salesPackage.offer.score, true],
    ["Conversão", avg(salesPackage.landing.score, salesPackage.copy.score, salesPackage.checkout.score), salesPackage.copy.ready],
  ] as const) {
    const s = buildStrength(value, label);
    if (s) strengths.push(s);
    if (!ready) weaknesses.push(`${label} ainda não está pronto.`);
    const w = buildWeakness(value, label);
    if (w) weaknesses.push(w);
  }

  return {
    strengths: strengths.length > 0 ? strengths : ["Pacote comercial funcional."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Funil comercial dentro do esperado."],
    recommendation: isSpecialistApproved(score)
      ? "Oferta e funil prontos para captar demanda."
      : "Fortalecer oferta, funil e diferenciação antes do lançamento.",
  };
}

function analyzeCopyChief(score: number, input: InvestmentCommitteeInput): Omit<InvestmentSpecialistReview, "name" | "score" | "approved"> {
  const { salesPackage } = input;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const items = [
    ["Headline (landing)", salesPackage.landing.score],
    ["Promessa (oferta)", salesPackage.offer.score],
    ["CTA (checkout)", salesPackage.checkout.score],
    ["Clareza (copy)", salesPackage.copy.score],
    ["Persuasão (copy + criativos)", avg(salesPackage.copy.score, salesPackage.creativePackage.score)],
  ] as const;

  for (const [label, value] of items) {
    const s = buildStrength(value, label);
    if (s) strengths.push(s);
    const w = buildWeakness(value, label);
    if (w) weaknesses.push(w);
  }

  if (!salesPackage.copy.ready) weaknesses.push("Copy ainda não gerada.");
  if (!salesPackage.landing.ready) weaknesses.push("Landing sem headline publicável.");

  return {
    strengths: strengths.length > 0 ? strengths : ["Mensagem comercial coerente."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Copy dentro do padrão mínimo."],
    recommendation: isSpecialistApproved(score)
      ? "Mensagem clara e persuasiva para conversão."
      : "Refinar headline, promessa e CTA antes de investir em tráfego.",
  };
}

function analyzeProductSpecialist(
  score: number,
  input: InvestmentCommitteeInput
): Omit<InvestmentSpecialistReview, "name" | "score" | "approved"> {
  const { salesPackage, meta } = input;
  const adherence = meta.product_strategy_adherence;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const quality = meta.product_quality_score ?? salesPackage.product.score;
  const s1 = buildStrength(quality, "Qualidade do produto");
  const s2 = buildStrength(adherence?.score ?? quality, "Aderência à estratégia");
  const s3 = adherence?.aligned ? "Produto alinhado à estratégia escolhida." : null;
  if (s1) strengths.push(s1);
  if (s2) strengths.push(s2);
  if (s3) strengths.push(s3);

  const w1 = buildWeakness(quality, "Qualidade");
  const w2 = buildWeakness(adherence?.score ?? quality, "Estrutura");
  if (w1) weaknesses.push(w1);
  if (w2) weaknesses.push(w2);
  if (!salesPackage.product.ready) weaknesses.push("Produto ainda não finalizado.");
  for (const p of adherence?.pendencies ?? []) {
    weaknesses.push(p);
  }

  return {
    strengths: strengths.length > 0 ? strengths : ["Produto entrega transformação prometida."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Estrutura de produto adequada."],
    recommendation: isSpecialistApproved(score)
      ? "Produto robusto e coerente com a promessa."
      : "Melhorar qualidade, estrutura e bônus antes do investimento.",
  };
}

function analyzePerformanceManager(
  score: number,
  input: InvestmentCommitteeInput
): Omit<InvestmentSpecialistReview, "name" | "score" | "approved"> {
  const { salesPackage, meta } = input;
  const brief = input.productBuildBrief ?? null;
  const opportunity = meta.selected_opportunity;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const scalability = opportunity?.opportunityScore.scalability ?? 60;
  const ticket = brief?.ticket ?? meta.ticket ?? opportunity?.price ?? 97;
  const ctr = avg(salesPackage.creativePackage.score, salesPackage.copy.score);

  const s1 = buildStrength(scalability, "Escalabilidade");
  const s2 = buildStrength(ctr, "CTR esperado (criativos + copy)");
  const s3 = ticket >= 200 ? `Ticket R$ ${ticket} sustenta CAC mais alto.` : null;
  if (s1) strengths.push(s1);
  if (s2) strengths.push(s2);
  if (s3) strengths.push(s3);

  const w1 = buildWeakness(scalability, "Escalabilidade");
  const w2 = buildWeakness(ctr, "CTR esperado");
  if (ticket < 97) weaknesses.push(`Ticket baixo (R$ ${ticket}) limita margem de CAC.`);
  if (w1) weaknesses.push(w1);
  if (w2) weaknesses.push(w2);
  if (salesPackage.commercialScore < 90) {
    weaknesses.push(`Commercial Score ${Math.round(salesPackage.commercialScore)} abaixo do ideal para escala.`);
  }

  return {
    strengths: strengths.length > 0 ? strengths : ["Potencial de tráfego aceitável."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Métricas de performance dentro do esperado."],
    recommendation: isSpecialistApproved(score)
      ? "Performance e escalabilidade sustentam investimento em mídia."
      : "Otimizar criativos e ticket antes de escalar tráfego pago.",
  };
}

function avg(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildMustFix(specialists: InvestmentSpecialistReview[]): string[] {
  const fixes: { priority: number; text: string }[] = [];

  for (const specialist of specialists) {
    if (specialist.approved) continue;
    const priority = 100 - specialist.score;
    for (const weakness of specialist.weaknesses) {
      fixes.push({
        priority,
        text: `[${specialist.name}] ${weakness}`,
      });
    }
    fixes.push({
      priority,
      text: `[${specialist.name}] ${specialist.recommendation}`,
    });
  }

  if (fixes.length === 0) {
    return [];
  }

  return [...fixes]
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.text)
    .filter((text, index, arr) => arr.indexOf(text) === index);
}

export function runInvestmentCommittee(input: InvestmentCommitteeInput): InvestmentCommitteeReport {
  const brief =
    input.productBuildBrief ??
    buildProductBuildBrief({ meta: input.meta }) ??
    null;

  const enrichedInput: InvestmentCommitteeInput = {
    ...input,
    productBuildBrief: brief,
  };

  const ceoScore = scoreCeo({ meta: input.meta, brief });
  const cmoScore = scoreCmo({ salesPackage: input.salesPackage, meta: input.meta });
  const copyScore = scoreCopyChief({ salesPackage: input.salesPackage });
  const productScore = scoreProductSpecialist({
    salesPackage: input.salesPackage,
    meta: input.meta,
    brief,
  });
  const performanceScore = scorePerformanceManager({
    salesPackage: input.salesPackage,
    meta: input.meta,
    brief,
  });

  const configs: SpecialistConfig[] = [
    { name: "CEO", score: ceoScore, analyze: () => analyzeCeo(ceoScore, enrichedInput) },
    { name: "CMO", score: cmoScore, analyze: () => analyzeCmo(cmoScore, enrichedInput) },
    { name: "Copy Chief", score: copyScore, analyze: () => analyzeCopyChief(copyScore, enrichedInput) },
    {
      name: "Product Specialist",
      score: productScore,
      analyze: () => analyzeProductSpecialist(productScore, enrichedInput),
    },
    {
      name: "Performance Manager",
      score: performanceScore,
      analyze: () => analyzePerformanceManager(performanceScore, enrichedInput),
    },
  ];

  const specialists: InvestmentSpecialistReview[] = configs.map((config) => {
    const analysis = config.analyze();
    return {
      name: config.name,
      score: config.score,
      approved: isSpecialistApproved(config.score),
      ...analysis,
    };
  });

  const investmentScore = computeInvestmentScore({
    CEO: ceoScore,
    CMO: cmoScore,
    "Copy Chief": copyScore,
    "Product Specialist": productScore,
    "Performance Manager": performanceScore,
  });

  const approved = isInvestmentApproved(
    investmentScore,
    specialists.map((s) => s.score)
  );

  const rejectedSpecialists = specialists.filter((s) => !s.approved).map((s) => s.name);
  const mustFix = buildMustFix(specialists);

  let globalRecommendation: string;
  if (approved) {
    globalRecommendation = "Comitê aprovou o investimento. Missão pronta para revisão final de lançamento.";
  } else {
    const rejectedList = rejectedSpecialists.join(", ");
    globalRecommendation = `${REJECTION_MESSAGE} Corrija os pontos abaixo. Especialistas reprovados: ${rejectedList}.`;
  }

  return {
    investmentScore,
    approved,
    specialists,
    globalRecommendation,
    mustFix,
  };
}

export function isCommitteeApproved(report: InvestmentCommitteeReport): boolean {
  return report.approved && report.investmentScore >= INVESTMENT_APPROVAL_THRESHOLD;
}
