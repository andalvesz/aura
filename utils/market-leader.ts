import type { ExcellenceAssetType, MarketBenchmark, MarketBenchmarkCategory } from "@/types/database";
import { clampScore } from "@/utils/specialist-engine";

export const MARKET_LEADER_MODE = {
  active: true,
  message:
    "Market Leader Mode compara cada ativo com benchmarks de mercado. Score Final = Excellence Score + Benchmark Score.",
};

export type BenchmarkCriterion = {
  key: string;
  label: string;
  weight: number;
  signals: string[];
  min_length?: number;
};

export type BenchmarkComparisonResult = {
  category: MarketBenchmarkCategory;
  benchmark_id: string | null;
  benchmark_name: string;
  benchmark_score: number;
  excellence_score?: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  criteria_scores: Array<{ key: string; label: string; score: number; note: string }>;
};

export const MARKET_BENCHMARK_CATEGORIES: MarketBenchmarkCategory[] = [
  "headline",
  "landing",
  "offer",
  "creative",
  "funnel",
];

export const MARKET_BENCHMARK_LABELS: Record<MarketBenchmarkCategory, string> = {
  headline: "Headline",
  landing: "Landing",
  offer: "Oferta",
  creative: "Criativo",
  funnel: "Funil",
};

const ASSET_TO_BENCHMARK_CATEGORY: Record<ExcellenceAssetType, MarketBenchmarkCategory> = {
  copy: "headline",
  landing: "landing",
  offer: "offer",
  creative: "creative",
  funnel: "funnel",
  product: "offer",
  ebook: "offer",
  campaign: "creative",
  strategy: "funnel",
};

export const DEFAULT_MARKET_BENCHMARKS: Array<
  Pick<MarketBenchmark, "category" | "name" | "description" | "criteria" | "reference_metrics">
> = [
  {
    category: "headline",
    name: "Headline Market Leader",
    description: "Headlines de alta conversão.",
    criteria: [
      { key: "clarity", label: "Clareza e especificidade", weight: 0.22, signals: ["como", "método", "passo", "resultado"], min_length: 15 },
      { key: "curiosity", label: "Curiosity gap ético", weight: 0.18, signals: ["descubra", "revelado", "segredo", "por que"], min_length: 10 },
      { key: "benefit", label: "Benefício tangível", weight: 0.25, signals: ["ganhe", "economize", "aumente", "transforme"], min_length: 10 },
      { key: "proof", label: "Prova social", weight: 0.2, signals: ["alunos", "clientes", "depoimento", "comprovado"], min_length: 8 },
      { key: "cta", label: "CTA clara", weight: 0.15, signals: ["comece", "garanta", "acesse", "quero"], min_length: 5 },
    ],
    reference_metrics: { avg_ctr: 0.035, top_ctr: 0.08 },
  },
  {
    category: "landing",
    name: "Landing Page Market Leader",
    description: "Landings acima da média.",
    criteria: [
      { key: "value_prop", label: "Proposta de valor", weight: 0.25, signals: ["promessa", "solução", "resultado", "benefício"], min_length: 40 },
      { key: "social_proof", label: "Prova social", weight: 0.2, signals: ["depoimento", "avaliação", "alunos", "clientes"], min_length: 20 },
      { key: "objections", label: "Objeções", weight: 0.18, signals: ["garantia", "risco", "funciona"], min_length: 25 },
      { key: "urgency", label: "Urgência ética", weight: 0.12, signals: ["vagas", "limitado", "hoje", "encerra"], min_length: 8 },
      { key: "structure", label: "Estrutura escaneável", weight: 0.25, signals: ["bullet", "passo", "módulo", "bônus"], min_length: 50 },
    ],
    reference_metrics: { avg_conversion: 0.035, top_conversion: 0.12 },
  },
  {
    category: "offer",
    name: "Offer Stack Market Leader",
    description: "Ofertas com alto take rate.",
    criteria: [
      { key: "anchoring", label: "Ancoragem de preço", weight: 0.2, signals: ["de r$", "por apenas", "valor", "investimento"], min_length: 15 },
      { key: "stack", label: "Stack de valor", weight: 0.25, signals: ["bônus", "inclui", "acesso", "módulo"], min_length: 30 },
      { key: "risk_reversal", label: "Reversão de risco", weight: 0.22, signals: ["garantia", "devolução", "reembolso"], min_length: 12 },
      { key: "scarcity", label: "Escassez legítima", weight: 0.13, signals: ["vagas", "limitado", "exclusivo"], min_length: 8 },
      { key: "payment", label: "Clareza de pagamento", weight: 0.2, signals: ["parcela", "pix", "cartão"], min_length: 10 },
    ],
    reference_metrics: { avg_take_rate: 0.035, top_take_rate: 0.15 },
  },
  {
    category: "creative",
    name: "Creative Market Leader",
    description: "Criativos com CTR acima do mercado.",
    criteria: [
      { key: "hook", label: "Hook 3s", weight: 0.3, signals: ["pare", "atenção", "você", "erro"], min_length: 12 },
      { key: "alignment", label: "Alinhamento visual-copy", weight: 0.18, signals: ["mostra", "veja", "antes", "depois"], min_length: 15 },
      { key: "cta", label: "CTA direto", weight: 0.2, signals: ["clique", "saiba", "link", "acesse"], min_length: 8 },
      { key: "platform", label: "Fit de plataforma", weight: 0.15, signals: ["stories", "reels", "feed", "mobile"], min_length: 8 },
      { key: "thumbstop", label: "Thumb-stopping", weight: 0.17, signals: ["novo", "grátis", "urgente", "exclusivo"], min_length: 10 },
    ],
    reference_metrics: { avg_ctr: 0.012, top_ctr: 0.045 },
  },
  {
    category: "funnel",
    name: "Funnel Market Leader",
    description: "Funis com AOV acima da média.",
    criteria: [
      { key: "coherence", label: "Coerência entre etapas", weight: 0.22, signals: ["próximo", "passo", "oferta", "upgrade"], min_length: 30 },
      { key: "aov", label: "Otimização de AOV", weight: 0.25, signals: ["bump", "upsell", "combo", "adicional"], min_length: 20 },
      { key: "upsell_logic", label: "Lógica de upsell", weight: 0.2, signals: ["complemento", "avançado", "completo", "premium"], min_length: 15 },
      { key: "thank_you", label: "Pós-compra", weight: 0.13, signals: ["obrigado", "acesso", "comunidade", "suporte"], min_length: 12 },
      { key: "path", label: "Caminho de conversão", weight: 0.2, signals: ["checkout", "comprar", "garantir", "finalizar"], min_length: 20 },
    ],
    reference_metrics: { avg_aov_multiplier: 1.8, top_aov_multiplier: 3.2 },
  },
];

export function mapAssetTypeToBenchmarkCategory(
  assetType: ExcellenceAssetType
): MarketBenchmarkCategory {
  return ASSET_TO_BENCHMARK_CATEGORY[assetType] ?? "landing";
}

function parseCriteria(raw: unknown): BenchmarkCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        key: typeof row.key === "string" ? row.key : "criterion",
        label: typeof row.label === "string" ? row.label : "Critério",
        weight: typeof row.weight === "number" ? row.weight : 0.2,
        signals: Array.isArray(row.signals)
          ? row.signals.filter((signal): signal is string => typeof signal === "string")
          : [],
        min_length: typeof row.min_length === "number" ? row.min_length : undefined,
      };
    });
}

function scoreBenchmarkCriterion(
  criterion: BenchmarkCriterion,
  content: string
): { score: number; note: string } {
  const lower = content.toLowerCase();
  const trimmed = content.trim();
  let score = 40;

  const signalHits = criterion.signals.filter((signal) => lower.includes(signal.toLowerCase())).length;
  if (criterion.signals.length > 0) {
    score += (signalHits / criterion.signals.length) * 35;
  }

  if (criterion.min_length && trimmed.length >= criterion.min_length) {
    score += 12;
  } else if (criterion.min_length && trimmed.length >= criterion.min_length * 0.6) {
    score += 6;
  }

  const labelWords = criterion.label
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4);
  const labelHits = labelWords.filter((word) => lower.includes(word)).length;
  if (labelWords.length > 0) {
    score += (labelHits / labelWords.length) * 10;
  }

  if (trimmed.length > 300) score += 3;

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    note:
      finalScore >= 80
        ? `Acima do benchmark de mercado em ${criterion.label.toLowerCase()}.`
        : finalScore >= 65
          ? `Próximo ao benchmark em ${criterion.label.toLowerCase()}.`
          : `Abaixo do benchmark em ${criterion.label.toLowerCase()} — reforçar antes de escalar.`,
  };
}

/**
 * Market Leader Mode V1:
 * Cada dimensão contribui até 50 pontos; soma compõe o score final (0–100).
 */
export function computeMarketLeaderFinalScore(
  excellenceScore: number,
  benchmarkScore: number
): number {
  const excellenceComponent = clampScore(excellenceScore) / 2;
  const benchmarkComponent = clampScore(benchmarkScore) / 2;
  return clampScore(excellenceComponent + benchmarkComponent);
}

export function compareToBenchmark(params: {
  content: string;
  category: MarketBenchmarkCategory;
  benchmark?: Pick<MarketBenchmark, "id" | "name" | "criteria"> | null;
}): BenchmarkComparisonResult {
  const fallback =
    DEFAULT_MARKET_BENCHMARKS.find((item) => item.category === params.category) ??
    DEFAULT_MARKET_BENCHMARKS[0]!;
  const benchmark = params.benchmark ?? fallback;
  const criteria = parseCriteria(benchmark.criteria ?? fallback.criteria);
  const content = params.content.trim();

  const criteriaScores = criteria.map((criterion) => {
    const result = scoreBenchmarkCriterion(criterion, content);
    return {
      key: criterion.key,
      label: criterion.label,
      score: result.score,
      note: result.note,
    };
  });

  let benchmarkScore = 0;
  let weightTotal = 0;
  for (const [index, criterion] of criteria.entries()) {
    const weight = criterion.weight > 0 ? criterion.weight : 1 / criteria.length;
    benchmarkScore += criteriaScores[index]!.score * weight;
    weightTotal += weight;
  }
  benchmarkScore = clampScore(weightTotal > 0 ? benchmarkScore / weightTotal : 0);

  const strengths = criteriaScores
    .filter((item) => item.score >= 75)
    .map((item) => `${item.label}: ${item.note}`)
    .slice(0, 4);

  const weaknesses = criteriaScores
    .filter((item) => item.score < 70)
    .map((item) => `${item.label} (${item.score.toFixed(0)}/100)`)
    .slice(0, 4);

  const recommendations = criteriaScores
    .filter((item) => item.score < 75)
    .map((item) => `Elevar ${item.label.toLowerCase()} para nível market leader.`)
    .slice(0, 4);

  if (!recommendations.length) {
    recommendations.push("Manter monitoramento vs concorrentes após publicação.");
  }
  if (!strengths.length) {
    strengths.push(`Base comparável ao benchmark ${benchmark.name ?? fallback.name}.`);
  }

  return {
    category: params.category,
    benchmark_id: "id" in benchmark && benchmark.id ? benchmark.id : null,
    benchmark_name: benchmark.name ?? fallback.name,
    benchmark_score: benchmarkScore,
    strengths,
    weaknesses,
    recommendations,
    criteria_scores: criteriaScores,
  };
}

export function buildMarketLeaderAuraContext(
  comparison: BenchmarkComparisonResult | null
): string {
  if (!comparison) return "Market Leader Mode: sem comparação de benchmark.";
  return [
    "=== Market Leader Mode ===",
    `Categoria: ${MARKET_BENCHMARK_LABELS[comparison.category]}`,
    `Benchmark: ${comparison.benchmark_name}`,
    `Benchmark Score: ${comparison.benchmark_score.toFixed(1)}`,
    comparison.strengths[0] ? `Força: ${comparison.strengths[0]}` : null,
    comparison.weaknesses[0] ? `Gap: ${comparison.weaknesses[0]}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
