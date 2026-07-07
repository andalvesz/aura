/**
 * Reality Engine — filters and ranks opportunities by user feasibility.
 *
 * Lower Reality Score → more conservative recommendations (cash-first, low capital).
 */

import type {
  BusinessPathStep,
  EvolutionPlanPhase,
  OpportunityConstraints,
  PathRecommendationPhase,
  RealityCheckItem,
  RealityProfile,
} from "@/lib/opportunity/opportunity-types";
import {
  BUSINESS_MODELS,
  type BusinessModel,
  type BusinessModelId,
  type ScoredOpportunityAngle,
} from "@/utils/business-reasoning";

export type ExperienceLevel = "iniciante" | "intermediario" | "avancado";
export type TechnicalLevel = "nenhum" | "basico" | "intermediario" | "avancado";
export type TeamSize = "sozinho" | "pequena" | "equipe";

export type ParsedRealityProfile = RealityProfile & {
  confidence: number;
};

export type RealityEngineResult = {
  profile: ParsedRealityProfile;
  realityScore: number;
  realityChecks: RealityCheckItem[];
  businessPath: BusinessPathStep[];
  evolutionPlan: EvolutionPlanPhase[];
  pathRecommendation: PathRecommendationPhase[];
  filteredCount: number;
  eliminatedModels: string[];
};

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  iniciante: 0,
  intermediario: 1,
  avancado: 2,
};

const CONSERVATIVE_MODEL_ORDER: BusinessModelId[] = [
  "servico",
  "consultoria",
  "mentoria",
  "templates",
  "kit",
  "curso",
  "automacao",
  "comunidade",
  "assinatura",
  "agencia",
  "ferramenta-ia",
  "licenciamento",
  "saas",
  "marketplace",
];

const MODEL_CONSTRAINTS: Record<BusinessModelId, OpportunityConstraints> = {
  servico: {
    minimumCapital: 0,
    minimumTimeHoursPerDay: 1,
    minimumExperience: "iniciante",
    complexity: 25,
    cashGenerationSpeed: 95,
  },
  consultoria: {
    minimumCapital: 500,
    minimumTimeHoursPerDay: 2,
    minimumExperience: "intermediario",
    complexity: 40,
    cashGenerationSpeed: 85,
  },
  mentoria: {
    minimumCapital: 500,
    minimumTimeHoursPerDay: 2,
    minimumExperience: "intermediario",
    complexity: 35,
    cashGenerationSpeed: 80,
  },
  templates: {
    minimumCapital: 200,
    minimumTimeHoursPerDay: 2,
    minimumExperience: "iniciante",
    complexity: 30,
    cashGenerationSpeed: 72,
  },
  kit: {
    minimumCapital: 300,
    minimumTimeHoursPerDay: 2,
    minimumExperience: "iniciante",
    complexity: 35,
    cashGenerationSpeed: 68,
  },
  curso: {
    minimumCapital: 1000,
    minimumTimeHoursPerDay: 3,
    minimumExperience: "iniciante",
    complexity: 45,
    cashGenerationSpeed: 60,
  },
  automacao: {
    minimumCapital: 2000,
    minimumTimeHoursPerDay: 3,
    minimumExperience: "intermediario",
    complexity: 55,
    cashGenerationSpeed: 55,
  },
  comunidade: {
    minimumCapital: 500,
    minimumTimeHoursPerDay: 2,
    minimumExperience: "intermediario",
    complexity: 40,
    cashGenerationSpeed: 50,
  },
  assinatura: {
    minimumCapital: 3000,
    minimumTimeHoursPerDay: 3,
    minimumExperience: "intermediario",
    complexity: 50,
    cashGenerationSpeed: 45,
  },
  agencia: {
    minimumCapital: 3000,
    minimumTimeHoursPerDay: 4,
    minimumExperience: "intermediario",
    complexity: 60,
    cashGenerationSpeed: 52,
  },
  "ferramenta-ia": {
    minimumCapital: 5000,
    minimumTimeHoursPerDay: 4,
    minimumExperience: "avancado",
    complexity: 70,
    cashGenerationSpeed: 40,
  },
  licenciamento: {
    minimumCapital: 8000,
    minimumTimeHoursPerDay: 3,
    minimumExperience: "avancado",
    complexity: 65,
    cashGenerationSpeed: 35,
  },
  saas: {
    minimumCapital: 10000,
    minimumTimeHoursPerDay: 4,
    minimumExperience: "avancado",
    complexity: 85,
    cashGenerationSpeed: 30,
  },
  marketplace: {
    minimumCapital: 20000,
    minimumTimeHoursPerDay: 5,
    minimumExperience: "avancado",
    complexity: 90,
    cashGenerationSpeed: 25,
  },
};

const MONEY_CAPTURE = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)`;

const CAPITAL_PATTERNS = [
  new RegExp(`(?:tenho|possuo|disponho\\s+de|apenas|somente)\\s*(?:r\\$\\s*)?${MONEY_CAPTURE}`, "i"),
  new RegExp(`(?:capital|or[cç]amento|budget)\\s*(?:de\\s*)?(?:r\\$\\s*)?${MONEY_CAPTURE}`, "i"),
  new RegExp(`r\\$\\s*${MONEY_CAPTURE}\\s*(?:de\\s+)?(?:capital|investimento|para\\s+come[cç]ar)`, "i"),
];

const MONTHLY_INVESTMENT_PATTERNS = [
  new RegExp(`(?:investir|investimento)\\s*(?:de\\s*)?(?:r\\$\\s*)?${MONEY_CAPTURE}\\s*(?:por\\s*m[eê]s|mensal|\\/m[eê]s)`, "i"),
  new RegExp(`(?:posso\\s+investir)\\s*(?:r\\$\\s*)?${MONEY_CAPTURE}`, "i"),
];

const TIME_PATTERNS: Array<{ pattern: RegExp; hours: number }> = [
  { pattern: /(?:apenas\s+)?fins?\s+de\s+semana/i, hours: 2 },
  { pattern: /(\d+)\s*h(?:oras?)?\s*(?:por\s*)?(?:dia|\/dia)/i, hours: -1 },
  { pattern: /(\d+)\s*horas?\s+por\s+dia/i, hours: -1 },
  { pattern: /(?:tempo\s+)?(?:limitado|pouco\s+tempo)/i, hours: 1 },
  { pattern: /(?:tempo\s+)?integral|dedica[cç][aã]o\s+total/i, hours: 8 },
];

const EXPERIENCE_PATTERNS: Array<{ pattern: RegExp; level: ExperienceLevel }> = [
  { pattern: /\b(?:iniciante|come[cç]ando|sem\s+experi[eê]ncia|nunca\s+vendi)\b/i, level: "iniciante" },
  { pattern: /\b(?:j[aá]\s+vendi|alguma\s+experi[eê]ncia|intermedi[aá]rio)\b/i, level: "intermediario" },
  { pattern: /\b(?:avan[cç]ado|expert|especialista|anos\s+de\s+experi[eê]ncia)\b/i, level: "avancado" },
];

const TECHNICAL_PATTERNS: Array<{ pattern: RegExp; level: TechnicalLevel }> = [
  { pattern: /\b(?:n[aã]o\s+sei\s+programar|sem\s+conhecimento\s+t[eé]cnico|leigo\s+em\s+tech)\b/i, level: "nenhum" },
  { pattern: /\b(?:gestor\s+de\s+tr[aá]fego|marketing\s+digital|vendas|comercial)\b/i, level: "basico" },
  { pattern: /\b(?:sei\s+programar|desenvolvedor|dev|no-?code|automa[cç][aã]o)\b/i, level: "intermediario" },
  { pattern: /\b(?:engenheiro|full\s*stack|saas|arquiteto\s+de\s+software)\b/i, level: "avancado" },
];

const PROFESSION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:sou\s+)?m[eé]dico[a]?\b/i, label: "Médico" },
  { pattern: /\b(?:sou\s+)?advogad[oa]\b/i, label: "Advogado" },
  { pattern: /\bgestor(?:a)?\s+de\s+tr[aá]fego\b/i, label: "Gestor de tráfego" },
  { pattern: /\bcontador(?:a)?\b/i, label: "Contador" },
  { pattern: /\bdentista\b/i, label: "Dentista" },
];

const DEADLINE_PATTERN = /\b(?:em|até|prazo\s+de)\s+(\d+)\s+(dias|semanas|meses)\b/i;

const FINANCIAL_GOAL_PATTERNS = [
  new RegExp(`(?:ganhar|faturar|receber|meta\\s+de)\\s*(?:r\\$\\s*)?${MONEY_CAPTURE}`, "i"),
  new RegExp(`r\\$\\s*${MONEY_CAPTURE}\\s*(?:por\\s*m[eê]s|mensal)`, "i"),
];

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export function getModelConstraints(modelId: BusinessModelId): OpportunityConstraints {
  return MODEL_CONSTRAINTS[modelId];
}

export function getConstraintsForModelLabel(label: string): OpportunityConstraints {
  const model = BUSINESS_MODELS.find((m) => m.label === label);
  if (!model) {
    return MODEL_CONSTRAINTS.servico;
  }
  return MODEL_CONSTRAINTS[model.id];
}

export function getModelTierIndex(modelId: BusinessModelId): number {
  const index = CONSERVATIVE_MODEL_ORDER.indexOf(modelId);
  return index >= 0 ? index : CONSERVATIVE_MODEL_ORDER.length;
}

function detectCapital(text: string): number | null {
  const capitalSection = text.split(/(?:quero|meta|ganhar|faturar)/i)[0] ?? text;

  for (const pattern of CAPITAL_PATTERNS) {
    const match = capitalSection.match(pattern);
    if (match?.[1]) {
      const value = parseMoney(match[1]);
      if (value > 0 && value <= 500000) return value;
    }
  }
  return null;
}

function detectMonthlyInvestment(text: string): number | null {
  for (const pattern of MONTHLY_INVESTMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseMoney(match[1]);
      if (value > 0) return value;
    }
  }
  return null;
}

function detectTimeHoursPerDay(text: string): number | null {
  for (const entry of TIME_PATTERNS) {
    const match = text.match(entry.pattern);
    if (!match) continue;
    if (entry.hours === -1 && match[1]) {
      const hours = Number(match[1]);
      if (hours > 0 && hours <= 16) return hours;
    }
    return entry.hours;
  }
  return null;
}

function detectExperience(text: string): ExperienceLevel | null {
  for (const entry of EXPERIENCE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.level;
  }
  return null;
}

function detectTechnicalLevel(text: string): TechnicalLevel | null {
  for (const entry of TECHNICAL_PATTERNS) {
    if (entry.pattern.test(text)) return entry.level;
  }
  return null;
}

function detectProfession(text: string): string | null {
  for (const entry of PROFESSION_PATTERNS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return null;
}

function detectFinancialGoal(text: string): number | null {
  for (const pattern of FINANCIAL_GOAL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseMoney(match[1]);
      if (value > 0) return value;
    }
  }
  return null;
}

function detectDeadline(text: string): string | null {
  const match = text.match(DEADLINE_PATTERN);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function detectTeam(text: string): TeamSize | null {
  if (/\b(?:sozinho|solo|sozinha|sem\s+equipe)\b/i.test(text)) return "sozinho";
  if (/\b(?:tenho\s+equipe|com\s+equipe|time\s+de|s[oó]cios?)\b/i.test(text)) return "equipe";
  if (/\b(?:dupla|parceiro|2\s+pessoas)\b/i.test(text)) return "pequena";
  return null;
}

function detectWantsToAppear(text: string): boolean | null {
  if (/\b(?:n[aã]o\s+quero\s+aparecer|sem\s+c[aâ]mera|bastidores|invis[ií]vel)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:quero\s+aparecer|gravar\s+v[ií]deos|ser\s+refer[eê]ncia)\b/i.test(text)) {
    return true;
  }
  return null;
}

function detectHasAudience(text: string): boolean {
  return /\b(?:j[aá]\s+tenho\s+audi[eê]ncia|tenho\s+seguidores|base\s+de\s+clientes|lista\s+de\s+email)\b/i.test(
    text
  );
}

function detectSalesExperience(text: string): boolean {
  return /\b(?:experi[eê]ncia\s+em\s+vendas|j[aá]\s+vendi|background\s+comercial)\b/i.test(text);
}

export function parseRealityProfile(goalText: string): ParsedRealityProfile {
  const raw = goalText.trim();
  let confidence = 0;

  const availableCapital = detectCapital(raw);
  if (availableCapital !== null) confidence += 15;

  const timeHoursPerDay = detectTimeHoursPerDay(raw);
  if (timeHoursPerDay !== null) confidence += 15;

  const experience = detectExperience(raw);
  if (experience !== null) confidence += 12;

  const financialGoal = detectFinancialGoal(raw);
  if (financialGoal !== null) confidence += 10;

  const deadline = detectDeadline(raw);
  if (deadline !== null) confidence += 8;

  const wantsToAppear = detectWantsToAppear(raw);
  if (wantsToAppear !== null) confidence += 8;

  const team = detectTeam(raw);
  if (team !== null) confidence += 10;

  const technicalKnowledge = detectTechnicalLevel(raw);
  if (technicalKnowledge !== null) confidence += 12;

  const monthlyInvestmentCapacity = detectMonthlyInvestment(raw);
  if (monthlyInvestmentCapacity !== null) confidence += 10;

  const profession = detectProfession(raw);
  if (profession !== null) confidence += 8;

  if (detectHasAudience(raw)) confidence += 8;
  if (detectSalesExperience(raw)) confidence += 5;

  return {
    raw,
    availableCapital: availableCapital ?? 5000,
    timeHoursPerDay: timeHoursPerDay ?? 4,
    experience: experience ?? "intermediario",
    financialGoal: financialGoal ?? 10000,
    deadline,
    wantsToAppear: wantsToAppear ?? true,
    team: team ?? "sozinho",
    technicalKnowledge: technicalKnowledge ?? "basico",
    monthlyInvestmentCapacity: monthlyInvestmentCapacity ?? 500,
    profession,
    hasAudience: detectHasAudience(raw),
    hasSalesExperience: detectSalesExperience(raw),
    confidence: Math.min(100, confidence),
  };
}

export function computeRealityScore(profile: RealityProfile): number {
  let score = 58;

  const capital = profile.availableCapital;
  if (capital <= 200) score -= 18;
  else if (capital <= 500) score -= 5;
  else if (capital <= 1000) score -= 8;
  else if (capital <= 2000) score -= 4;
  else if (capital <= 5000) score += 0;
  else if (capital <= 10000) score += 6;
  else if (capital <= 20000) score += 12;
  else score += 18;

  const time = profile.timeHoursPerDay;
  if (time <= 1) score -= 12;
  else if (time <= 2) score -= 3;
  else if (time <= 3) score -= 2;
  else if (time <= 4) score += 0;
  else if (time <= 6) score += 5;
  else score += 10;

  if (profile.experience === "iniciante") score -= 4;
  else if (profile.experience === "intermediario") score += 2;
  else score += 10;

  if (profile.team === "sozinho") score -= 3;
  else if (profile.team === "pequena") score += 4;
  else score += 8;

  const tech = profile.technicalKnowledge;
  if (tech === "nenhum") score -= 6;
  else if (tech === "basico") score += 0;
  else if (tech === "intermediario") score += 5;
  else score += 10;

  const monthly = profile.monthlyInvestmentCapacity;
  if (monthly <= 200) score -= 5;
  else if (monthly <= 500) score -= 2;
  else if (monthly <= 1000) score += 0;
  else if (monthly <= 3000) score += 3;
  else score += 6;

  if (profile.hasAudience) score += 8;
  if (profile.hasSalesExperience) score += 4;
  if (profile.wantsToAppear === false) score -= 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMaxModelTier(realityScore: number): number {
  if (realityScore < 35) return 5;
  if (realityScore < 50) return 7;
  if (realityScore < 65) return 10;
  return CONSERVATIVE_MODEL_ORDER.length - 1;
}

export function computeRealityPenalty(
  modelId: BusinessModelId,
  profile: RealityProfile
): number {
  const constraints = MODEL_CONSTRAINTS[modelId];
  let penalty = 0;

  if (profile.availableCapital < constraints.minimumCapital) {
    const gap =
      constraints.minimumCapital === 0
        ? 0
        : 1 - profile.availableCapital / constraints.minimumCapital;
    penalty += Math.round(Math.max(0, gap) * 55);
  }

  if (profile.timeHoursPerDay < constraints.minimumTimeHoursPerDay) {
    const gap = 1 - profile.timeHoursPerDay / constraints.minimumTimeHoursPerDay;
    penalty += Math.round(Math.max(0, gap) * 35);
  }

  const userExp = EXPERIENCE_RANK[profile.experience];
  const requiredExp = EXPERIENCE_RANK[constraints.minimumExperience];
  if (userExp < requiredExp) {
    penalty += (requiredExp - userExp) * 25;
  }

  if (profile.team === "sozinho" && (modelId === "agencia" || modelId === "marketplace")) {
    penalty += 20;
  }

  if (profile.technicalKnowledge === "nenhum" && constraints.complexity >= 65) {
    penalty += 15;
  }

  if (!profile.wantsToAppear && (modelId === "curso" || modelId === "mentoria")) {
    penalty += 12;
  }

  return Math.min(100, penalty);
}

export function isOpportunityCompatible(
  modelId: BusinessModelId,
  profile: RealityProfile,
  realityScore: number
): boolean {
  const penalty = computeRealityPenalty(modelId, profile);
  if (penalty >= 70) return false;

  const tier = getModelTierIndex(modelId);
  if (tier > getMaxModelTier(realityScore)) return false;

  return true;
}

export function filterAnglesByReality(
  angles: ScoredOpportunityAngle[],
  profile: RealityProfile,
  realityScore: number
): { compatible: ScoredOpportunityAngle[]; eliminated: string[] } {
  const eliminated = new Set<string>();
  const compatible: ScoredOpportunityAngle[] = [];

  for (const angle of angles) {
    if (isOpportunityCompatible(angle.businessModel.id, profile, realityScore)) {
      compatible.push(angle);
    } else {
      eliminated.add(angle.businessModel.label);
    }
  }

  if (compatible.length < 3) {
    const fallbackOrder = CONSERVATIVE_MODEL_ORDER.filter((id) =>
      isOpportunityCompatible(id, profile, realityScore)
    );

    for (const modelId of fallbackOrder) {
      if (compatible.length >= 3) break;
      const model = BUSINESS_MODELS.find((m) => m.id === modelId);
      if (!model) continue;
      const exists = compatible.some((a) => a.businessModel.id === modelId);
      if (exists) continue;

      const primaryProblem = angles[0]?.problem ?? angles[0]?.problem;
      if (!primaryProblem) continue;

      compatible.push({
        problem: angles[0]!.problem,
        businessModel: model,
        modelScore: 40,
        problemScore: 35,
        totalScore: 37,
        justification: `Modelo viável para seu perfil de realidade — ${model.label} gera caixa mais rápido com menor capital.`,
        nicheIds: angles[0]!.nicheIds,
      });
    }
  }

  return { compatible, eliminated: [...eliminated] };
}

export function applyRealityBoost(
  angle: ScoredOpportunityAngle,
  profile: RealityProfile,
  realityScore: number
): number {
  const constraints = MODEL_CONSTRAINTS[angle.businessModel.id];
  const penalty = computeRealityPenalty(angle.businessModel.id, profile);
  const conservatism = (100 - realityScore) / 100;
  const cashBoost = (constraints.cashGenerationSpeed / 100) * conservatism * 25;
  const capitalFit =
    profile.availableCapital >= constraints.minimumCapital
      ? 8
      : -penalty * 0.3;

  return angle.totalScore + cashBoost + capitalFit;
}

export function buildRealityChecks(
  profile: RealityProfile,
  realityScore: number,
  topModel: BusinessModel | null
): RealityCheckItem[] {
  const checks: RealityCheckItem[] = [];

  if (profile.availableCapital <= 1000) {
    checks.push({
      constraint: "capital",
      message: `Você informou possuir apenas ${formatBrl(profile.availableCapital)}. Por isso NÃO recomendo iniciar por um SaaS ou marketplace — o investimento médio para validar esses modelos é superior ao seu orçamento. Recomendo gerar caixa primeiro através de serviço especializado.`,
      severity: profile.availableCapital <= 500 ? "block" : "warning",
    });
  }

  if (profile.timeHoursPerDay <= 2) {
    checks.push({
      constraint: "tempo",
      message: `Com ${profile.timeHoursPerDay}h/dia disponíveis, modelos de alta complexidade (SaaS, marketplace, agência) ficam fora do caminho viável agora. Priorize entregas que monetizam em dias, não meses.`,
      severity: "warning",
    });
  }

  if (profile.experience === "iniciante") {
    checks.push({
      constraint: "experiencia",
      message:
        "Perfil iniciante detectado — o caminho começa com validação rápida (serviço ou produto simples) antes de escalar para modelos recorrentes.",
      severity: "info",
    });
  }

  if (profile.team === "sozinho") {
    checks.push({
      constraint: "equipe",
      message:
        "Operando sozinho, evite modelos que exigem entrega simultânea para muitos clientes. Foque em ticket médio e poucos clientes bem atendidos.",
      severity: "info",
    });
  }

  if (!profile.wantsToAppear) {
    checks.push({
      constraint: "visibilidade",
      message:
        "Você preferiu não aparecer — curso e mentoria ao vivo perdem prioridade. Templates, automação e serviço nos bastidores encaixam melhor.",
      severity: "info",
    });
  }

  if (realityScore < 50 && topModel && (topModel.id === "saas" || topModel.id === "marketplace")) {
    checks.push({
      constraint: "reality-score",
      message: `Reality Score ${realityScore}/100 — recomendação ajustada para modelos mais conservadores que cabem na sua realidade hoje.`,
      severity: "block",
    });
  }

  if (checks.length === 0) {
    checks.push({
      constraint: "viabilidade",
      message: `Reality Score ${realityScore}/100 — seu perfil suporta modelos mais escaláveis. Ainda assim, o caminho recomendado começa pelo que gera caixa mais rápido.`,
      severity: "info",
    });
  }

  return checks;
}

export function buildBusinessPath(
  profile: RealityProfile,
  startModel: BusinessModel
): BusinessPathStep[] {
  const steps: BusinessPathStep[] = [
    { phase: "Hoje", action: `Validar demanda com ${startModel.label.toLowerCase()}`, modelHint: startModel.label },
    { phase: "Fase 1", action: "Conseguir 3 clientes pagantes", modelHint: "Serviço" },
    { phase: "Fase 2", action: "Automatizar entrega e processos repetitivos", modelHint: "Automação" },
    { phase: "Fase 3", action: "Criar templates e materiais reutilizáveis", modelHint: "Templates" },
    { phase: "Fase 4", action: "Empacotar conhecimento em produto digital", modelHint: "Produto digital" },
    { phase: "Fase 5", action: "Lançar assinatura com entrega contínua", modelHint: "Assinatura" },
    { phase: "Fase 6", action: "Evoluir para SaaS quando houver caixa e validação", modelHint: "SaaS" },
  ];

  if (profile.hasAudience) {
    steps[1] = { phase: "Fase 1", action: "Converter audiência existente em 3 clientes", modelHint: "Serviço" };
  }

  if (profile.profession) {
    steps[0] = {
      phase: "Hoje",
      action: `Monetizar expertise como ${profile.profession} com ${startModel.label.toLowerCase()}`,
      modelHint: startModel.label,
    };
  }

  return steps;
}

export function buildEvolutionPlan(
  profile: RealityProfile,
  startModel: BusinessModel
): EvolutionPlanPhase[] {
  return [
    {
      label: "Semana 1",
      focus: `Oferta mínima de ${startModel.label.toLowerCase()}`,
      milestone: "Definir promessa, preço e 5 prospects para contato",
    },
    {
      label: "Semana 2",
      focus: "Primeiras conversas e proposta",
      milestone: "3 propostas enviadas · meta: 1 cliente pagante",
    },
    {
      label: "30 dias",
      focus: "Validação de demanda e entrega",
      milestone: "3 clientes ativos · processo de entrega documentado",
    },
    {
      label: "90 dias",
      focus: "Automação e produtização",
      milestone: "Templates ou automações que reduzem tempo de entrega em 40%",
    },
    {
      label: "180 dias",
      focus: "Produto digital ou recorrência",
      milestone:
        profile.availableCapital >= 5000
          ? "Lançar assinatura ou produto escalável"
          : "Caixa suficiente para investir no próximo modelo",
    },
  ];
}

export function buildPathRecommendation(
  profile: RealityProfile,
  startModel: BusinessModel
): PathRecommendationPhase[] {
  return [
    {
      horizon: "Agora",
      recommendation: `${startModel.label} focado em gerar caixa imediato`,
      model: startModel.label,
    },
    {
      horizon: "30 dias",
      recommendation: "3 clientes pagantes e processo de entrega repetível",
      model: "Serviço",
    },
    {
      horizon: "90 dias",
      recommendation: "Automatizar entrega e criar materiais reutilizáveis",
      model: "Automação",
    },
    {
      horizon: "180 dias",
      recommendation: "Produto digital ou assinatura com base na validação",
      model: "Produto digital",
    },
    {
      horizon: "1 ano",
      recommendation:
        profile.availableCapital >= 10000 && profile.experience !== "iniciante"
          ? "Micro SaaS ou ferramenta com receita recorrente"
          : "Escalar produto validado antes de investir em SaaS",
      model: profile.availableCapital >= 10000 ? "Micro SaaS" : "Assinatura",
    },
  ];
}

export function runRealityEngine(goalText: string): RealityEngineResult {
  const profile = parseRealityProfile(goalText);
  const realityScore = computeRealityScore(profile);
  const startModel =
    BUSINESS_MODELS.find((m) => m.id === CONSERVATIVE_MODEL_ORDER[0]) ?? BUSINESS_MODELS[6]!;

  return {
    profile,
    realityScore,
    realityChecks: buildRealityChecks(profile, realityScore, startModel),
    businessPath: buildBusinessPath(profile, startModel),
    evolutionPlan: buildEvolutionPlan(profile, startModel),
    pathRecommendation: buildPathRecommendation(profile, startModel),
    filteredCount: 0,
    eliminatedModels: [],
  };
}

export function runRealityOnAngles(
  goalText: string,
  angles: ScoredOpportunityAngle[]
): {
  reality: RealityEngineResult;
  rankedAngles: ScoredOpportunityAngle[];
} {
  const profile = parseRealityProfile(goalText);
  const realityScore = computeRealityScore(profile);
  const { compatible, eliminated } = filterAnglesByReality(angles, profile, realityScore);

  const rankedAngles = compatible
    .map((angle) => ({
      angle,
      boosted: applyRealityBoost(angle, profile, realityScore),
    }))
    .sort((a, b) => b.boosted - a.boosted)
    .map((entry) => entry.angle);

  const startModel = rankedAngles[0]?.businessModel ?? BUSINESS_MODELS.find((m) => m.id === "servico")!;

  const reality: RealityEngineResult = {
    profile,
    realityScore,
    realityChecks: buildRealityChecks(profile, realityScore, startModel),
    businessPath: buildBusinessPath(profile, startModel),
    evolutionPlan: buildEvolutionPlan(profile, startModel),
    pathRecommendation: buildPathRecommendation(profile, startModel),
    filteredCount: angles.length - compatible.length,
    eliminatedModels: eliminated,
  };

  return { reality, rankedAngles };
}
