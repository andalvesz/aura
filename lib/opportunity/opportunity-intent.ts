import { DIGITAL_NICHES } from "@/lib/opportunity/opportunity-dataset";
import type { DigitalNiche, OpportunityIntent } from "@/lib/opportunity/opportunity-types";

/** Keyword signals per niche id — used for intent extraction and matching. */
export const NICHE_KEYWORDS: Record<string, string[]> = {
  ia: [
    "ia",
    "inteligência artificial",
    "inteligencia artificial",
    "chatgpt",
    "gpt",
    "automação com ia",
    "automacao com ia",
    "machine learning",
    "prompt",
  ],
  produtividade: ["produtividade", "produtivo", "organização", "organizacao", "planner digital", "planner de"],
  "marketing-digital": ["marketing digital", "marketing", "tráfego", "trafego", "funil", "leads"],
  copywriting: ["copy", "copywriting", "texto de venda", "headline"],
  instagram: ["instagram", "reels", "stories", "perfil no insta"],
  youtube: ["youtube", "canal no youtube", "monetizar canal"],
  excel: ["excel", "planilha excel", "planilhas excel"],
  "power-bi": ["power bi", "powerbi", "dashboard bi"],
  "financas-pessoais": ["finanças pessoais", "financas pessoais", "orçamento pessoal", "organizar gastos", "planner financeiro"],
  investimentos: ["investimento", "investir", "bolsa de valores", "ações", "renda fixa"],
  emagrecimento: ["emagrecer", "emagrecimento", "dieta", "perder peso"],
  musculacao: ["musculação", "musculacao", "hipertrofia", "treino"],
  nutricao: ["nutrição", "nutricao", "alimentação saudável"],
  relacionamentos: ["relacionamento", "namoro", "casal"],
  ingles: ["inglês", "ingles", "english"],
  concursos: ["concurso público", "concurseiro", "concurso"],
  tdah: ["tdah", "déficit de atenção", "deficit de atencao"],
  autismo: ["autismo", "tea", "espectro autista"],
  fotografia: ["fotografia", "fotógrafo", "fotografo"],
  "design-grafico": ["design gráfico", "design grafico", "canva"],
  arquitetura: ["arquitetura", "arquiteto"],
  direito: ["direito", "advogado", "advogada", "jurídico", "juridico"],
  odontologia: ["odontologia", "dentista"],
  medicos: ["médico", "medico", "medicina"],
  farmacia: ["farmácia", "farmacia", "farmacêutico"],
  contabilidade: ["contabilidade", "contador", "contadora"],
  imobiliaria: ["imobiliária", "imobiliaria", "corretor de imóveis", "corretor", "corretores"],
  "energia-solar": ["energia solar", "fotovoltaico", "painel solar", "instalador solar"],
  consorcio: ["consórcio", "consorcio"],
  estetica: ["estética", "estetica", "beleza", "skincare"],
  programacao: ["programação", "programacao", "código", "codigo", "desenvolvedor", "dev"],
  ecommerce: ["e-commerce", "ecommerce", "loja virtual", "loja online"],
  dropshipping: ["dropshipping", "drop shipping"],
  "trafego-pago": ["tráfego pago", "trafego pago", "facebook ads", "google ads", "meta ads", "lojas online"],
  infoprodutos: ["infoproduto", "infoprodutos", "curso online", "produto digital"],
  coaching: ["coaching", "coach de vida", "mentoria"],
  psicologia: ["psicologia", "psicólogo", "psicologo", "terapia"],
  "educacao-infantil": ["educação infantil", "educacao infantil", "maternal"],
  "enem-vestibular": ["enem", "vestibular"],
  espanhol: ["espanhol", "español"],
  moda: ["moda", "estilo pessoal", "look"],
  cabelo: ["cabelo", "cabeleireiro", "cachos"],
  pet: ["pet", "pet shop", "cachorro", "cães", "caes", "gato", "adestramento"],
  jardinagem: ["jardinagem", "plantas", "horta"],
  culinaria: ["culinária", "culinaria", "receitas", "confeitaria"],
  viagens: ["viagens", "turismo", "mochilão"],
  mindfulness: ["mindfulness", "meditação", "meditacao"],
  empreendedorismo: ["empreendedorismo", "empreendedor", "negócio digital", "negocio digital"],
  freelancer: ["freelancer", "freela", "autônomo", "autonomo"],
  "rh-carreira": ["carreira", "currículo", "curriculo", "rh", "recolocação"],
  agro: ["agro", "agronegócio", "agronegocio", "fazenda"],
  "saude-mental": ["saúde mental", "saude mental", "ansiedade", "burnout"],
  "cannabis-medicinal": ["cannabis medicinal", "cbd"],
  criptomoedas: ["criptomoedas", "bitcoin", "crypto"],
  barbearia: ["barbearia", "barbeiro", "barba"],
};

/** Technology terms map to primary niche ids (strongest signal). */
const TECHNOLOGY_SIGNALS: Array<{ pattern: RegExp; label: string; nicheIds: string[] }> = [
  { pattern: /\b(?:ia|i\.a\.|intelig[eê]ncia artificial|chatgpt|gpt-?4|prompts?)\b/i, label: "Inteligência Artificial", nicheIds: ["ia"] },
  { pattern: /\bexcel\b/i, label: "Excel", nicheIds: ["excel"] },
  { pattern: /\b(?:power\s*bi|powerbi)\b/i, label: "Power BI", nicheIds: ["power-bi"] },
  { pattern: /\binstagram\b/i, label: "Instagram", nicheIds: ["instagram"] },
  { pattern: /\byoutube\b/i, label: "YouTube", nicheIds: ["youtube"] },
  { pattern: /\b(?:marketing(?:\s+digital)?|tr[aá]fego(?:\s+pago)?)\b/i, label: "Marketing Digital", nicheIds: ["marketing-digital", "trafego-pago"] },
  { pattern: /\b(?:copy(?:writing)?)\b/i, label: "Copywriting", nicheIds: ["copywriting"] },
  { pattern: /\b(?:e-?commerce|loja virtual|loja online)\b/i, label: "E-commerce", nicheIds: ["ecommerce"] },
  { pattern: /\b(?:programa[cç][aã]o|coding|dev|software)\b/i, label: "Programação", nicheIds: ["programacao"] },
];

/** Avatar phrases extracted from user goal. */
const AVATAR_EXTRACTORS: Array<{ pattern: RegExp; label: string; nicheHints: string[] }> = [
  { pattern: /pequenos?\s+neg[oó]cios?/i, label: "Pequenos negócios", nicheHints: ["empreendedorismo", "ia", "marketing-digital", "contabilidade"] },
  { pattern: /(?:micro)?empreendedor(?:es)?/i, label: "Empreendedores", nicheHints: ["empreendedorismo", "marketing-digital"] },
  { pattern: /advogad[oa]s?/i, label: "Advogados", nicheHints: ["direito"] },
  { pattern: /dentistas?/i, label: "Dentistas", nicheHints: ["odontologia"] },
  { pattern: /m[eé]dicos?/i, label: "Médicos", nicheHints: ["medicos"] },
  { pattern: /contador(?:es|as)?/i, label: "Contadores", nicheHints: ["contabilidade"] },
  { pattern: /mulheres?\s+(?:de\s+)?(\d{2})\s*\+?/i, label: "Mulheres maduras", nicheHints: ["emagrecimento", "estetica", "empreendedorismo"] },
  { pattern: /mulheres?/i, label: "Mulheres", nicheHints: ["emagrecimento", "estetica"] },
  { pattern: /homens?/i, label: "Homens", nicheHints: ["musculacao", "barbearia"] },
  { pattern: /iniciantes?/i, label: "Iniciantes", nicheHints: ["empreendedorismo", "marketing-digital"] },
  { pattern: /freelancers?/i, label: "Freelancers", nicheHints: ["freelancer", "copywriting"] },
  { pattern: /criadores?\s+de\s+conte[uú]do/i, label: "Criadores de conteúdo", nicheHints: ["instagram", "youtube"] },
  { pattern: /infoprodutores?/i, label: "Infoprodutores", nicheHints: ["infoprodutos", "marketing-digital"] },
  { pattern: /concurseiros?/i, label: "Concurseiros", nicheHints: ["concursos"] },
  { pattern: /pais(?:\s+e\s+m[aã]es)?/i, label: "Pais", nicheHints: ["educacao-infantil"] },
];

/** Problem phrases extracted from user goal. */
const PROBLEM_EXTRACTORS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:ajudar|ensinar)\s+(?:a\s+)?(.+?)(?:\s+a\s+|\s+com\s+|\.|,|$)/i, label: "" },
  { pattern: /(?:resolver|solucionar)\s+(.+?)(?:\.|,|$)/i, label: "" },
  { pattern: /(?:problema\s+(?:de|com))\s+(.+?)(?:\.|,|$)/i, label: "" },
  { pattern: /(?:quem\s+)(?:n[aã]o\s+consegue|perde|sofre\s+com)\s+(.+?)(?:\.|,|$)/i, label: "" },
];

/** Market context from user goal. */
const MARKET_EXTRACTORS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:eua|usa|estados\s+unidos|united\s+states)\b/i, label: "EUA" },
  { pattern: /\b(?:espanha|mercado\s+espanhol)\b/i, label: "Espanha" },
  { pattern: /\b(?:brasil|mercado\s+brasileiro|br)\b/i, label: "Brasil" },
  { pattern: /pequenos?\s+neg[oó]cios?/i, label: "Pequenos negócios (PME)" },
  { pattern: /\bb2b\b/i, label: "B2B" },
  { pattern: /\bb2c\b/i, label: "B2C" },
];

/** Related niches when a primary technology/niche is detected. */
const NICHE_RELATED_CLUSTERS: Record<string, string[]> = {
  ia: ["ia", "produtividade", "marketing-digital", "empreendedorismo", "copywriting", "programacao", "infoprodutos", "ecommerce"],
  excel: ["excel", "power-bi", "contabilidade"],
  "power-bi": ["power-bi", "excel", "contabilidade"],
  instagram: ["instagram", "marketing-digital", "copywriting"],
  youtube: ["youtube", "marketing-digital", "copywriting"],
  "marketing-digital": ["marketing-digital", "trafego-pago", "copywriting", "instagram", "infoprodutos", "ecommerce"],
  copywriting: ["copywriting", "marketing-digital", "instagram", "infoprodutos"],
  direito: ["direito"],
  emagrecimento: ["emagrecimento", "nutricao", "musculacao"],
  empreendedorismo: ["empreendedorismo", "marketing-digital", "ia", "infoprodutos"],
  "financas-pessoais": ["financas-pessoais", "investimentos"],
  ecommerce: ["ecommerce", "dropshipping", "trafego-pago", "marketing-digital", "ia"],
  "trafego-pago": ["trafego-pago", "marketing-digital", "ecommerce", "instagram"],
  imobiliaria: ["imobiliaria", "marketing-digital"],
  pet: ["pet"],
  "energia-solar": ["energia-solar", "empreendedorismo"],
};

export const INTENT_MATCH_MIN_SCORE = 40;
export const INTENT_RANK_WEIGHT = 0.6;
export const MARKET_RANK_WEIGHT = 0.4;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsKeyword(text: string, keyword: string): boolean {
  const normalized = normalizeText(text);
  const normalizedKw = normalizeText(keyword);

  if (normalizedKw.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9])${normalizedKw}(?:[^a-z0-9]|$)`);
    return re.test(normalized);
  }

  return normalized.includes(normalizedKw);
}

function findNicheIdsByKeywords(goalText: string): string[] {
  const matched = new Set<string>();

  for (const [nicheId, keywords] of Object.entries(NICHE_KEYWORDS)) {
    for (const kw of keywords) {
      if (containsKeyword(goalText, kw)) {
        matched.add(nicheId);
        break;
      }
    }
  }

  return [...matched];
}

function detectTechnology(goalText: string): { label: string; nicheIds: string[] } | null {
  for (const signal of TECHNOLOGY_SIGNALS) {
    if (signal.pattern.test(goalText)) {
      return { label: signal.label, nicheIds: signal.nicheIds };
    }
  }
  return null;
}

function detectAvatar(goalText: string): { label: string; nicheHints: string[] } | null {
  for (const extractor of AVATAR_EXTRACTORS) {
    const match = goalText.match(extractor.pattern);
    if (match) {
      let label = extractor.label;
      if (match[1] && extractor.pattern.source.includes("(\\d{2})")) {
        label = `Mulheres ${match[1]}+`;
      }
      return { label, nicheHints: extractor.nicheHints };
    }
  }
  return null;
}

function detectProblem(goalText: string): string | null {
  for (const extractor of PROBLEM_EXTRACTORS) {
    const match = goalText.match(extractor.pattern);
    if (match?.[1]) {
      const cleaned = match[1].trim().replace(/\s+/g, " ");
      if (cleaned.length >= 4 && cleaned.length <= 120) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }
  }
  return null;
}

function detectMarket(goalText: string): string | null {
  for (const extractor of MARKET_EXTRACTORS) {
    if (extractor.pattern.test(goalText)) {
      return extractor.label;
    }
  }
  return null;
}

function resolvePrimaryNicheIds(
  keywordIds: string[],
  technology: { nicheIds: string[] } | null,
  avatar: { nicheHints: string[] } | null
): string[] {
  const ids = new Set<string>();

  if (technology) {
    for (const id of technology.nicheIds) ids.add(id);
  }

  for (const id of keywordIds) ids.add(id);

  if (avatar) {
    for (const id of avatar.nicheHints) ids.add(id);
  }

  return [...ids];
}

function expandRelatedNicheIds(primaryIds: string[]): Set<string> {
  const expanded = new Set<string>();

  for (const id of primaryIds) {
    expanded.add(id);
    const cluster = NICHE_RELATED_CLUSTERS[id];
    if (cluster) {
      for (const related of cluster) expanded.add(related);
    }
  }

  return expanded;
}

function computeConfidence(input: {
  technology: string | null;
  niche: string | null;
  avatar: string | null;
  problem: string | null;
  market: string | null;
  matchedNicheIds: string[];
  hasRevenue: boolean;
}): number {
  let score = 0;

  if (input.technology) score += 30;
  if (input.niche) score += 25;
  if (input.avatar) score += 15;
  if (input.problem) score += 10;
  if (input.market) score += 10;
  if (input.matchedNicheIds.length > 0) score += 10;
  if (input.matchedNicheIds.length > 1) score += 5;
  if (input.hasRevenue) score += 5;

  return Math.min(100, score);
}

function nicheLabelForId(id: string): string | null {
  return DIGITAL_NICHES.find((n) => n.id === id)?.name ?? null;
}

export function parseOpportunityIntent(goalText: string, hasRevenue = false): OpportunityIntent {
  const trimmed = goalText.trim();
  const keywordIds = findNicheIdsByKeywords(trimmed);
  const technology = detectTechnology(trimmed);
  const avatar = detectAvatar(trimmed);
  const problem = detectProblem(trimmed);
  const market = detectMarket(trimmed);

  const primaryIds = resolvePrimaryNicheIds(keywordIds, technology, avatar);
  const relatedIds = expandRelatedNicheIds(primaryIds);

  const explicitNiche =
    technology !== null ||
    keywordIds.length > 0 ||
    (avatar !== null && avatar.nicheHints.length > 0);

  const nicheLabel =
    technology?.label ??
    (keywordIds[0] ? nicheLabelForId(keywordIds[0]) : null) ??
    (avatar?.nicheHints[0] ? nicheLabelForId(avatar.nicheHints[0]) : null);

  const confidence = computeConfidence({
    technology: technology?.label ?? null,
    niche: nicheLabel,
    avatar: avatar?.label ?? null,
    problem,
    market,
    matchedNicheIds: [...relatedIds],
    hasRevenue,
  });

  return {
    raw: trimmed,
    niche: nicheLabel,
    technology: technology?.label ?? null,
    avatar: avatar?.label ?? null,
    market,
    problem,
    matchedNicheIds: [...relatedIds],
    primaryNicheIds: primaryIds,
    confidence,
    explicitNiche,
  };
}

function avatarOverlapScore(niche: DigitalNiche, intent: OpportunityIntent): number {
  if (!intent.avatar) return 0;

  const avatarNorm = normalizeText(intent.avatar);
  const nicheAvatarNorm = normalizeText(niche.avatar);
  const nicheNameNorm = normalizeText(niche.name);

  if (nicheAvatarNorm.includes(avatarNorm) || avatarNorm.includes(nicheAvatarNorm)) {
    return 25;
  }

  for (const hintId of intent.primaryNicheIds) {
    if (hintId === niche.id) return 20;
  }

  if (intent.matchedNicheIds.includes(niche.id)) return 15;

  const avatarWords = avatarNorm.split(/\s+/).filter((w) => w.length > 3);
  const overlap = avatarWords.filter(
    (w) => nicheAvatarNorm.includes(w) || nicheNameNorm.includes(w)
  ).length;

  return Math.min(20, overlap * 8);
}

function problemOverlapScore(niche: DigitalNiche, intent: OpportunityIntent): number {
  if (!intent.problem) return 0;

  const problemNorm = normalizeText(intent.problem);
  const nicheProblemNorm = normalizeText(niche.problem);

  const problemWords = problemNorm.split(/\s+/).filter((w) => w.length > 3);
  const overlap = problemWords.filter((w) => nicheProblemNorm.includes(w)).length;

  return Math.min(15, overlap * 5);
}

export function computeNicheIntentMatch(niche: DigitalNiche, intent: OpportunityIntent): number {
  if (!intent.explicitNiche) {
    return intent.matchedNicheIds.includes(niche.id) ? 50 : 0;
  }

  let score = 0;

  if (intent.primaryNicheIds.includes(niche.id)) {
    score += 65;
  } else if (intent.matchedNicheIds.includes(niche.id)) {
    score += 50;
  }

  const keywords = NICHE_KEYWORDS[niche.id] ?? [niche.name.toLowerCase()];
  for (const kw of keywords) {
    if (containsKeyword(intent.raw, kw)) {
      score += kw.length > 5 ? 30 : 20;
      break;
    }
  }

  if (intent.technology) {
    const tech = TECHNOLOGY_SIGNALS.find((t) => t.label === intent.technology);
    if (tech?.nicheIds.includes(niche.id)) {
      score += 25;
    }
  }

  score += avatarOverlapScore(niche, intent);
  score += problemOverlapScore(niche, intent);

  for (const example of niche.examples) {
    if (containsKeyword(intent.raw, example)) {
      score += 8;
      break;
    }
  }

  return Math.min(100, score);
}

export function isNicheIntentRelated(niche: DigitalNiche, intent: OpportunityIntent): boolean {
  if (!intent.explicitNiche) return true;
  return computeNicheIntentMatch(niche, intent) >= INTENT_MATCH_MIN_SCORE;
}

export function blendIntentAndMarketScore(
  intentMatch: number,
  marketScore: number,
  explicitNiche: boolean
): number {
  if (explicitNiche) {
    return Math.round((intentMatch * INTENT_RANK_WEIGHT + marketScore * MARKET_RANK_WEIGHT) * 100) / 100;
  }

  const boost = intentMatch > 0 ? intentMatch * 0.15 : 0;
  return Math.round(Math.min(100, marketScore + boost) * 100) / 100;
}
