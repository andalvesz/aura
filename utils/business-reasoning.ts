/**
 * Business Reasoning Engine
 *
 * Reasoning order:
 * Objective → Intent → Problems → Market → Avatar → Technologies → Business Models → Opportunities
 */

export type BusinessModelId =
  | "curso"
  | "mentoria"
  | "comunidade"
  | "kit"
  | "templates"
  | "consultoria"
  | "servico"
  | "agencia"
  | "saas"
  | "automacao"
  | "assinatura"
  | "licenciamento"
  | "marketplace"
  | "ferramenta-ia";

export type ProblemId =
  | "perder-clientes"
  | "baixa-conversao"
  | "poucas-vendas"
  | "marketing-fraco"
  | "atendimento-lento"
  | "falta-organizacao"
  | "falta-automacao"
  | "leads-ruins"
  | "trabalho-manual"
  | "fluxo-caixa-ruim";

export type UrgencyLevel = "baixa" | "media" | "alta";

export type BusinessProblem = {
  id: ProblemId;
  label: string;
  keywords: string[];
  impliedKeywords: string[];
  models: BusinessModelId[];
  nicheIds: string[];
};

export type BusinessModel = {
  id: BusinessModelId;
  label: string;
  keywords: string[];
  problems: ProblemId[];
  ticketRange: { min: number; max: number };
  launchDays: number;
  scalability: number;
  justify: (ctx: ReasoningContext) => string;
};

export type FinancialGoal = {
  monthlyRevenue: number;
  currency: "BRL" | "USD";
};

export type ReasoningContext = {
  raw: string;
  financialGoal: FinancialGoal;
  technology: string | null;
  market: string | null;
  avatar: string | null;
  problems: BusinessProblem[];
  primaryProblem: BusinessProblem;
  urgency: UrgencyLevel | null;
  deadline: string | null;
  desiredBusinessModel: string | null;
};

export type BusinessReasoningResult = {
  raw: string;
  financialGoal: FinancialGoal;
  technology: string | null;
  market: string | null;
  avatar: string | null;
  problems: string[];
  primaryProblem: string;
  urgency: UrgencyLevel | null;
  deadline: string | null;
  desiredBusinessModel: string | null;
  recommendedBusinessModel: string;
  businessModelJustification: string;
  confidence: number;
  matchedProblemIds: ProblemId[];
  matchedNicheIds: string[];
  rankedModels: Array<{ model: string; score: number; justification: string }>;
};

export type ScoredOpportunityAngle = {
  problem: BusinessProblem;
  businessModel: BusinessModel;
  modelScore: number;
  problemScore: number;
  totalScore: number;
  justification: string;
  nicheIds: string[];
};

const GOAL_REVENUE_PATTERNS = [
  /(?:ganhar|faturar|receber|lucre|lucrar|atingir|meta\s+de)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/i,
  /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:por\s*m[eê]s|mensal|\/m[eê]s)/i,
  /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:per\s*month|monthly|\/month)/i,
  /(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:reais?\s*)?(?:por\s*m[eê]s|mensal)/i,
];

export const BUSINESS_PROBLEMS: BusinessProblem[] = [
  {
    id: "perder-clientes",
    label: "Perder clientes",
    keywords: ["perder clientes", "perco clientes", "perdem clientes", "perde clientes", "churn", "clientes saindo", "retenção baixa"],
    impliedKeywords: ["fidelizar", "reter clientes"],
    models: ["consultoria", "mentoria", "comunidade", "servico"],
    nicheIds: ["marketing-digital", "empreendedorismo", "coaching"],
  },
  {
    id: "baixa-conversao",
    label: "Baixa conversão",
    keywords: ["baixa conversão", "baixa conversao", "não converte", "nao converte", "conversão baixa"],
    impliedKeywords: ["funil", "landing page", "vendas baixas"],
    models: ["consultoria", "agencia", "curso", "mentoria"],
    nicheIds: ["copywriting", "marketing-digital", "trafego-pago"],
  },
  {
    id: "poucas-vendas",
    label: "Poucas vendas",
    keywords: ["poucas vendas", "vender mais", "aumentar vendas", "pouco faturamento"],
    impliedKeywords: ["faturar", "ganhar", "receita"],
    models: ["mentoria", "curso", "agencia", "consultoria"],
    nicheIds: ["marketing-digital", "empreendedorismo", "copywriting"],
  },
  {
    id: "marketing-fraco",
    label: "Marketing fraco",
    keywords: ["marketing fraco", "marketing ruim", "sem marketing", "não atrai clientes"],
    impliedKeywords: ["tráfego", "trafego", "leads", "instagram", "anúncios"],
    models: ["agencia", "consultoria", "curso", "servico"],
    nicheIds: ["marketing-digital", "instagram", "trafego-pago"],
  },
  {
    id: "atendimento-lento",
    label: "Atendimento lento",
    keywords: ["atendimento lento", "demora no atendimento", "suporte lento", "whatsapp lotado"],
    impliedKeywords: ["atendimento", "suporte", "sac"],
    models: ["automacao", "saas", "ferramenta-ia", "servico"],
    nicheIds: ["ia", "empreendedorismo"],
  },
  {
    id: "falta-organizacao",
    label: "Falta de organização",
    keywords: ["falta de organização", "falta de organizacao", "desorganizado", "sem processo"],
    impliedKeywords: ["produtividade", "planner", "gestão", "gestao"],
    models: ["templates", "kit", "curso", "consultoria"],
    nicheIds: ["produtividade", "empreendedorismo"],
  },
  {
    id: "falta-automacao",
    label: "Falta de automação",
    keywords: ["falta de automação", "falta de automacao", "sem automação", "processos manuais"],
    impliedKeywords: ["automatizar", "automação com ia", "chatgpt", "ia"],
    models: ["ferramenta-ia", "automacao", "saas", "consultoria"],
    nicheIds: ["ia", "programacao", "empreendedorismo"],
  },
  {
    id: "leads-ruins",
    label: "Leads ruins",
    keywords: ["leads ruins", "leads frios", "leads desqualificados", "prospects ruins"],
    impliedKeywords: ["qualificar leads", "prospecção", "prospeccao"],
    models: ["consultoria", "agencia", "curso", "mentoria"],
    nicheIds: ["marketing-digital", "trafego-pago", "copywriting"],
  },
  {
    id: "trabalho-manual",
    label: "Muito trabalho manual",
    keywords: ["trabalho manual", "muito manual", "repetitivo", "tarefas repetitivas"],
    impliedKeywords: ["automatizar", "planilha", "processo"],
    models: ["automacao", "templates", "saas", "ferramenta-ia"],
    nicheIds: ["ia", "excel", "produtividade"],
  },
  {
    id: "fluxo-caixa-ruim",
    label: "Fluxo de caixa ruim",
    keywords: ["fluxo de caixa", "caixa apertado", "finanças ruins", "financas ruins"],
    impliedKeywords: ["organizar gastos", "lucro", "margem"],
    models: ["consultoria", "mentoria", "curso", "assinatura"],
    nicheIds: ["financas-pessoais", "contabilidade", "empreendedorismo"],
  },
];

export const BUSINESS_MODELS: BusinessModel[] = [
  {
    id: "curso",
    label: "Curso",
    keywords: ["curso", "aulas", "videoaulas"],
    problems: ["poucas-vendas", "marketing-fraco", "baixa-conversao"],
    ticketRange: { min: 97, max: 1997 },
    launchDays: 45,
    scalability: 85,
    justify: (ctx) =>
      `Curso escala conhecimento sobre "${ctx.primaryProblem.label}" com margem alta e entrega gravada — ideal para ${ctx.avatar ?? "o avatar"} sem depender só de demanda genérica.`,
  },
  {
    id: "mentoria",
    label: "Mentoria",
    keywords: ["mentoria", "mentor", "acompanhamento"],
    problems: ["poucas-vendas", "perder-clientes", "leads-ruins"],
    ticketRange: { min: 497, max: 5000 },
    launchDays: 21,
    scalability: 55,
    justify: (ctx) =>
      `Mentoria justifica ticket alto ao atacar "${ctx.primaryProblem.label}" com acompanhamento próximo — melhor que curso quando o problema exige implementação guiada.`,
  },
  {
    id: "comunidade",
    label: "Comunidade",
    keywords: ["comunidade", "membership", "grupo fechado"],
    problems: ["perder-clientes", "poucas-vendas"],
    ticketRange: { min: 47, max: 297 },
    launchDays: 30,
    scalability: 80,
    justify: (ctx) =>
      `Comunidade gera receita recorrente enquanto retém quem sofre com "${ctx.primaryProblem.label}" — retenção supera curso avulso neste cenário.`,
  },
  {
    id: "kit",
    label: "Kit",
    keywords: ["kit", "pacote", "bundle"],
    problems: ["falta-organizacao", "trabalho-manual"],
    ticketRange: { min: 47, max: 497 },
    launchDays: 14,
    scalability: 90,
    justify: (ctx) =>
      `Kit entrega resultado rápido para "${ctx.primaryProblem.label}" com baixo custo de produção — melhor que curso quando o usuário quer ação imediata.`,
  },
  {
    id: "templates",
    label: "Templates",
    keywords: ["template", "templates", "modelos prontos"],
    problems: ["falta-organizacao", "trabalho-manual"],
    ticketRange: { min: 27, max: 197 },
    launchDays: 10,
    scalability: 95,
    justify: (ctx) =>
      `Templates eliminam trabalho manual ligado a "${ctx.primaryProblem.label}" — lançamento rápido com prova de valor tangível.`,
  },
  {
    id: "consultoria",
    label: "Consultoria",
    keywords: ["consultoria", "consultor", "diagnóstico"],
    problems: ["baixa-conversao", "fluxo-caixa-ruim", "leads-ruins"],
    ticketRange: { min: 1500, max: 15000 },
    launchDays: 14,
    scalability: 40,
    justify: (ctx) =>
      `Consultoria ataca "${ctx.primaryProblem.label}" com diagnóstico personalizado — justificado quando meta financeira exige ticket alto e poucas vendas.`,
  },
  {
    id: "servico",
    label: "Serviço",
    keywords: ["serviço", "servico", "prestação", "freela"],
    problems: ["marketing-fraco", "atendimento-lento"],
    ticketRange: { min: 500, max: 8000 },
    launchDays: 7,
    scalability: 35,
    justify: (ctx) =>
      `Serviço monetiza rápido o problema "${ctx.primaryProblem.label}" enquanto valida demanda antes de escalar para produto.`,
  },
  {
    id: "agencia",
    label: "Agência",
    keywords: ["agência", "agencia", "gestão de tráfego", "social media"],
    problems: ["marketing-fraco", "baixa-conversao", "leads-ruins"],
    ticketRange: { min: 2000, max: 20000 },
    launchDays: 21,
    scalability: 50,
    justify: (ctx) =>
      `Agência resolve "${ctx.primaryProblem.label}" por execução contínua — melhor que curso quando o cliente precisa de resultado operacional, não só educação.`,
  },
  {
    id: "saas",
    label: "SaaS",
    keywords: ["saas", "software", "plataforma", "sistema"],
    problems: ["falta-automacao", "atendimento-lento", "trabalho-manual"],
    ticketRange: { min: 97, max: 997 },
    launchDays: 90,
    scalability: 95,
    justify: (ctx) =>
      `SaaS escala a solução de "${ctx.primaryProblem.label}" com receita recorrente — superior a curso quando o valor está na ferramenta, não no conteúdo.`,
  },
  {
    id: "automacao",
    label: "Automação",
    keywords: ["automação", "automacao", "workflow", "integração"],
    problems: ["falta-automacao", "trabalho-manual", "atendimento-lento"],
    ticketRange: { min: 297, max: 4997 },
    launchDays: 30,
    scalability: 88,
    justify: (ctx) =>
      `Automação ataca diretamente "${ctx.primaryProblem.label}" — modelo superior a infoproduto quando processos repetitivos são a raiz do problema.`,
  },
  {
    id: "assinatura",
    label: "Assinatura",
    keywords: ["assinatura", "recorrência", "recorrente", "mensalidade"],
    problems: ["perder-clientes", "fluxo-caixa-ruim"],
    ticketRange: { min: 47, max: 497 },
    launchDays: 30,
    scalability: 92,
    justify: (ctx) =>
      `Assinatura estabiliza receita contra "${ctx.primaryProblem.label}" com LTV previsível — melhor que venda única para meta mensal consistente.`,
  },
  {
    id: "licenciamento",
    label: "Licenciamento",
    keywords: ["licenciamento", "licença", "white label"],
    problems: ["poucas-vendas", "falta-automacao"],
    ticketRange: { min: 997, max: 9997 },
    launchDays: 60,
    scalability: 75,
    justify: (ctx) =>
      `Licenciamento escala "${ctx.primaryProblem.label}" via parceiros — ideal quando há método replicável e meta financeira alta.`,
  },
  {
    id: "marketplace",
    label: "Marketplace",
    keywords: ["marketplace", "intermediação", "plataforma de conexão"],
    problems: ["poucas-vendas", "leads-ruins"],
    ticketRange: { min: 0, max: 500 },
    launchDays: 120,
    scalability: 98,
    justify: (ctx) =>
      `Marketplace monetiza "${ctx.primaryProblem.label}" por transação em escala — quando o problema é conectar oferta e demanda.`,
  },
  {
    id: "ferramenta-ia",
    label: "Ferramenta IA",
    keywords: ["ferramenta ia", "ferramenta de ia", "produto ia", "chatgpt"],
    problems: ["falta-automacao", "trabalho-manual", "atendimento-lento"],
    ticketRange: { min: 97, max: 997 },
    launchDays: 45,
    scalability: 93,
    justify: (ctx) =>
      `Ferramenta IA resolve "${ctx.primaryProblem.label}" com entrega escalável — não é curso: o valor está na automação inteligente, não em aulas.`,
  },
];

const TECHNOLOGY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:ia|i\.a\.|intelig[eê]ncia artificial|chatgpt|gpt|prompts?)\b/i, label: "Inteligência Artificial" },
  { pattern: /\bexcel\b/i, label: "Excel" },
  { pattern: /\b(?:power\s*bi|powerbi)\b/i, label: "Power BI" },
  { pattern: /\binstagram\b/i, label: "Instagram" },
  { pattern: /\byoutube\b/i, label: "YouTube" },
  { pattern: /\b(?:marketing(?:\s+digital)?|tr[aá]fego(?:\s+pago)?)\b/i, label: "Marketing Digital" },
  { pattern: /\b(?:e-?commerce|loja virtual|loja online)\b/i, label: "E-commerce" },
  { pattern: /\b(?:automa[cç][aã]o|automatizar)\b/i, label: "Automação" },
];

const MARKET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:eua|usa|estados\s+unidos)\b/i, label: "EUA" },
  { pattern: /\b(?:espanha|mercado\s+espanhol)\b/i, label: "Espanha" },
  { pattern: /\b(?:brasil|mercado\s+brasileiro)\b/i, label: "Brasil" },
  { pattern: /pequenos?\s+neg[oó]cios?/i, label: "Pequenos negócios (PME)" },
  { pattern: /\bb2b\b/i, label: "B2B" },
  { pattern: /\bb2c\b/i, label: "B2C" },
];

const AVATAR_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /pequenos?\s+neg[oó]cios?/i, label: "Pequenos negócios" },
  { pattern: /(?:micro)?empreendedor(?:es)?/i, label: "Empreendedores" },
  { pattern: /advogad[oa]s?/i, label: "Advogados" },
  { pattern: /dentistas?/i, label: "Dentistas" },
  { pattern: /contador(?:es|as)?/i, label: "Contadores" },
  { pattern: /mulheres?\s+(?:de\s+)?\d{2}\s*\+?/i, label: "Mulheres maduras" },
  { pattern: /freelancers?/i, label: "Freelancers" },
  { pattern: /infoprodutores?/i, label: "Infoprodutores" },
  { pattern: /criadores?\s+de\s+conte[uú]do/i, label: "Criadores de conteúdo" },
];

const URGENCY_PATTERNS: Array<{ pattern: RegExp; level: UrgencyLevel }> = [
  { pattern: /\b(?:urgente|urgência|rapido|rápido|agora|imediato)\b/i, level: "alta" },
  { pattern: /\b(?:em\s+\d+\s+(?:dias|semanas|meses))\b/i, level: "media" },
  { pattern: /\b(?:sem pressa|longo prazo)\b/i, level: "baixa" },
];

const DEADLINE_PATTERN = /\b(?:em|até|prazo\s+de)\s+(\d+)\s+(dias|semanas|meses)\b/i;

const MODEL_PATTERNS: Array<{ pattern: RegExp; modelId: BusinessModelId }> = [
  { pattern: /\bcurso\b/i, modelId: "curso" },
  { pattern: /\bmentoria\b/i, modelId: "mentoria" },
  { pattern: /\bcomunidade\b/i, modelId: "comunidade" },
  { pattern: /\b(?:saas|software|plataforma)\b/i, modelId: "saas" },
  { pattern: /\bconsultoria\b/i, modelId: "consultoria" },
  { pattern: /\bag[eê]ncia\b/i, modelId: "agencia" },
  { pattern: /\bassinatura\b/i, modelId: "assinatura" },
  { pattern: /\bmarketplace\b/i, modelId: "marketplace" },
  { pattern: /\b(?:ferramenta\s+ia|produto\s+ia)\b/i, modelId: "ferramenta-ia" },
  { pattern: /\btemplates?\b/i, modelId: "templates" },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsPhrase(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase));
}

function parseRevenueNumber(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function parseFinancialGoal(text: string): FinancialGoal {
  let monthlyRevenue = 0;
  let currency: FinancialGoal["currency"] = "BRL";

  for (const pattern of GOAL_REVENUE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      monthlyRevenue = parseRevenueNumber(match[1]);
      if (pattern.source.includes("\\$") && !pattern.source.includes("r\\$")) {
        currency = "USD";
      }
      break;
    }
  }

  if (monthlyRevenue === 0) monthlyRevenue = 10000;

  return { monthlyRevenue, currency };
}

function detectTechnology(text: string): string | null {
  for (const t of TECHNOLOGY_PATTERNS) {
    if (t.pattern.test(text)) return t.label;
  }
  return null;
}

function detectMarket(text: string): string | null {
  for (const m of MARKET_PATTERNS) {
    if (m.pattern.test(text)) return m.label;
  }
  return null;
}

function detectAvatar(text: string): string | null {
  for (const a of AVATAR_PATTERNS) {
    if (a.pattern.test(text)) return a.label;
  }
  return null;
}

function detectUrgency(text: string): UrgencyLevel | null {
  for (const u of URGENCY_PATTERNS) {
    if (u.pattern.test(text)) return u.level;
  }
  return null;
}

function detectDeadline(text: string): string | null {
  const match = text.match(DEADLINE_PATTERN);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function detectDesiredModel(text: string): string | null {
  for (const m of MODEL_PATTERNS) {
    if (m.pattern.test(text)) {
      return BUSINESS_MODELS.find((b) => b.id === m.modelId)?.label ?? null;
    }
  }
  return null;
}

function scoreProblem(problem: BusinessProblem, text: string, technology: string | null): number {
  let score = 0;
  const allKeywords = [...problem.keywords, ...problem.impliedKeywords];

  for (const kw of allKeywords) {
    if (containsPhrase(text, kw)) score += kw.length > 8 ? 35 : 25;
  }

  if (technology === "Inteligência Artificial" && problem.id === "falta-automacao") score += 30;
  if (technology === "Inteligência Artificial" && problem.id === "trabalho-manual") score += 25;
  if (technology === "Marketing Digital" && problem.id === "marketing-fraco") score += 35;
  if (technology === "Marketing Digital" && problem.id === "baixa-conversao") score += 25;
  if (technology === "Excel" && problem.id === "trabalho-manual") score += 45;
  if (technology === "Excel" && problem.id === "falta-organizacao") score += 30;
  if (technology === "Instagram" && problem.id === "marketing-fraco") score += 35;
  if (technology === "Automação" && problem.id === "falta-automacao") score += 40;
  if (containsPhrase(text, "vender") || containsPhrase(text, "faturar") || containsPhrase(text, "ganhar")) {
    if (problem.id === "poucas-vendas" && !technology) score += 20;
    else if (problem.id === "poucas-vendas") score += 8;
  }
  if (containsPhrase(text, "usando ia") || containsPhrase(text, "com ia")) {
    if (problem.id === "falta-automacao") score += 40;
    if (problem.id === "trabalho-manual") score += 25;
  }

  return score;
}

function rankProblems(text: string, technology: string | null): BusinessProblem[] {
  return [...BUSINESS_PROBLEMS]
    .map((p) => ({ problem: p, score: scoreProblem(p, text, technology) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.problem);
}

function inferProblemsWhenNone(
  text: string,
  technology: string | null,
  financialGoal: FinancialGoal
): BusinessProblem[] {
  const inferred: BusinessProblem[] = [];

  if (technology === "Inteligência Artificial") {
    inferred.push(
      BUSINESS_PROBLEMS.find((p) => p.id === "falta-automacao")!,
      BUSINESS_PROBLEMS.find((p) => p.id === "trabalho-manual")!
    );
  } else if (technology === "Marketing Digital" || technology === "Instagram") {
    inferred.push(
      BUSINESS_PROBLEMS.find((p) => p.id === "marketing-fraco")!,
      BUSINESS_PROBLEMS.find((p) => p.id === "poucas-vendas")!
    );
  } else if (containsPhrase(text, "ganhar") || containsPhrase(text, "faturar")) {
    inferred.push(
      BUSINESS_PROBLEMS.find((p) => p.id === "poucas-vendas")!,
      BUSINESS_PROBLEMS.find((p) => p.id === "marketing-fraco")!,
      BUSINESS_PROBLEMS.find((p) => p.id === "baixa-conversao")!
    );
  }

  if (financialGoal.monthlyRevenue >= 20000) {
    inferred.push(BUSINESS_PROBLEMS.find((p) => p.id === "fluxo-caixa-ruim")!);
  }

  if (inferred.length === 0) {
    inferred.push(BUSINESS_PROBLEMS.find((p) => p.id === "poucas-vendas")!);
  }

  return [...new Map(inferred.map((p) => [p.id, p])).values()];
}

function scoreBusinessModel(
  model: BusinessModel,
  ctx: ReasoningContext,
  problem: BusinessProblem
): number {
  let score = 0;

  if (problem.models.includes(model.id)) score += 45;
  if (model.problems.includes(problem.id)) score += 25;

  if (ctx.desiredBusinessModel && ctx.desiredBusinessModel === model.label) score += 50;

  const midpoint = (model.ticketRange.min + model.ticketRange.max) / 2;
  const salesNeeded = midpoint > 0 ? ctx.financialGoal.monthlyRevenue / midpoint : 999;

  if (salesNeeded <= 30) score += 20;
  else if (salesNeeded <= 100) score += 12;
  else if (salesNeeded > 300) score -= 10;

  if (ctx.technology === "Inteligência Artificial") {
    if (model.id === "ferramenta-ia" || model.id === "automacao" || model.id === "saas") score += 35;
    if (model.id === "curso") score -= 15;
  }

  if (ctx.urgency === "alta" && model.launchDays <= 21) score += 15;
  if (ctx.urgency === "alta" && model.launchDays > 60) score -= 10;

  if (ctx.financialGoal.monthlyRevenue >= 15000) {
    if (model.id === "consultoria" || model.id === "agencia" || model.id === "mentoria") score += 15;
  }

  if (ctx.financialGoal.monthlyRevenue <= 8000) {
    if (model.id === "kit" || model.id === "templates" || model.id === "curso") score += 10;
  }

  return Math.max(0, score);
}

function pickRecommendedModel(
  ctx: ReasoningContext,
  problem: BusinessProblem
): { model: BusinessModel; score: number; justification: string } {
  const ranked = BUSINESS_MODELS.map((model) => {
    const score = scoreBusinessModel(model, ctx, problem);
    return {
      model,
      score,
      justification: model.justify({ ...ctx, primaryProblem: problem }),
    };
  }).sort((a, b) => b.score - a.score);

  if (ctx.desiredBusinessModel) {
    const desired = ranked.find((r) => r.model.label === ctx.desiredBusinessModel);
    if (desired && desired.score >= 30) return desired;
  }

  return ranked[0]!;
}

function computeConfidence(ctx: ReasoningContext, hasExplicitProblem: boolean): number {
  let score = 0;
  if (ctx.financialGoal.monthlyRevenue !== 10000) score += 15;
  if (ctx.technology) score += 20;
  if (ctx.market) score += 15;
  if (ctx.avatar) score += 15;
  if (hasExplicitProblem) score += 20;
  if (ctx.problems.length > 1) score += 5;
  if (ctx.urgency) score += 5;
  if (ctx.deadline) score += 5;
  if (ctx.desiredBusinessModel) score += 15;
  if (!hasExplicitProblem && ctx.problems.length > 0) score += 10;
  return Math.min(100, score);
}

export function runBusinessReasoning(goalText: string): BusinessReasoningResult {
  const raw = goalText.trim();
  const financialGoal = parseFinancialGoal(raw);
  const technology = detectTechnology(raw);
  const market = detectMarket(raw);
  const avatar = detectAvatar(raw);
  const urgency = detectUrgency(raw);
  const deadline = detectDeadline(raw);
  const desiredBusinessModel = detectDesiredModel(raw);

  let rankedProblems = rankProblems(raw, technology);
  const hasExplicitProblem = rankedProblems.length > 0;

  if (rankedProblems.length === 0) {
    rankedProblems = inferProblemsWhenNone(raw, technology, financialGoal);
  }

  const primaryProblem = rankedProblems[0]!;
  const ctx: ReasoningContext = {
    raw,
    financialGoal,
    technology,
    market,
    avatar,
    problems: rankedProblems,
    primaryProblem,
    urgency,
    deadline,
    desiredBusinessModel,
  };

  const recommended = pickRecommendedModel(ctx, primaryProblem);

  const rankedModels = BUSINESS_MODELS.map((model) => ({
    model: model.label,
    score: scoreBusinessModel(model, ctx, primaryProblem),
    justification: model.justify(ctx),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const matchedNicheIds = [
    ...new Set(rankedProblems.flatMap((p) => p.nicheIds)),
  ];

  const confidence = computeConfidence(ctx, hasExplicitProblem);

  return {
    raw,
    financialGoal,
    technology,
    market,
    avatar,
    problems: rankedProblems.map((p) => p.label),
    primaryProblem: primaryProblem.label,
    urgency,
    deadline,
    desiredBusinessModel,
    recommendedBusinessModel: recommended.model.label,
    businessModelJustification: recommended.justification,
    confidence,
    matchedProblemIds: rankedProblems.map((p) => p.id),
    matchedNicheIds,
    rankedModels,
  };
}

export function buildOpportunityAngles(reasoning: BusinessReasoningResult): ScoredOpportunityAngle[] {
  const problems = reasoning.matchedProblemIds
    .map((id) => BUSINESS_PROBLEMS.find((p) => p.id === id))
    .filter((p): p is BusinessProblem => Boolean(p));

  const ctx: ReasoningContext = {
    raw: reasoning.raw,
    financialGoal: reasoning.financialGoal,
    technology: reasoning.technology,
    market: reasoning.market,
    avatar: reasoning.avatar,
    problems,
    primaryProblem: problems[0] ?? BUSINESS_PROBLEMS[0]!,
    urgency: reasoning.urgency,
    deadline: reasoning.deadline,
    desiredBusinessModel: reasoning.desiredBusinessModel,
  };

  const angles: ScoredOpportunityAngle[] = [];

  for (const problem of problems.slice(0, 3)) {
    const modelsForProblem = BUSINESS_MODELS.map((model) => ({
      model,
      modelScore: scoreBusinessModel(model, ctx, problem),
      problemScore: scoreProblem(problem, reasoning.raw, reasoning.technology),
    }))
      .sort((a, b) => b.modelScore - a.modelScore)
      .slice(0, 3);

    for (const entry of modelsForProblem) {
      const totalScore = entry.problemScore * 0.45 + entry.modelScore * 0.55;
      angles.push({
        problem,
        businessModel: entry.model,
        modelScore: entry.modelScore,
        problemScore: entry.problemScore,
        totalScore,
        justification: entry.model.justify({ ...ctx, primaryProblem: problem }),
        nicheIds: problem.nicheIds,
      });
    }
  }

  const deduped = angles
    .sort((a, b) => b.totalScore - a.totalScore)
    .filter(
      (angle, index, arr) =>
        arr.findIndex(
          (x) => x.problem.id === angle.problem.id && x.businessModel.id === angle.businessModel.id
        ) === index
    );

  if (deduped.length >= 3) return deduped;

  const primary = problems[0] ?? BUSINESS_PROBLEMS.find((p) => p.id === "poucas-vendas")!;
  const usedModelIds = new Set(deduped.map((a) => a.businessModel.id));

  for (const model of BUSINESS_MODELS) {
    if (deduped.length >= 3) break;
    if (usedModelIds.has(model.id)) continue;
    usedModelIds.add(model.id);
    const problemScore = scoreProblem(primary, reasoning.raw, reasoning.technology);
    const modelScore = scoreBusinessModel(model, ctx, primary);
    deduped.push({
      problem: primary,
      businessModel: model,
      modelScore,
      problemScore,
      totalScore: problemScore * 0.45 + modelScore * 0.55,
      justification: model.justify({ ...ctx, primaryProblem: primary }),
      nicheIds: primary.nicheIds,
    });
  }

  return deduped;
}

export function getProblemById(id: ProblemId): BusinessProblem | undefined {
  return BUSINESS_PROBLEMS.find((p) => p.id === id);
}

export function getBusinessModelById(id: BusinessModelId): BusinessModel | undefined {
  return BUSINESS_MODELS.find((m) => m.id === id);
}
