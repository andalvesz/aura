import type { GrowthBrainMemory, GrowthPattern, Json } from "@/types/database";

export type GrowthBrainMemoryStatus = "active" | "archived" | "learning";

export type GrowthBrainMetricType = "estimated" | "real";

export type GrowthResultInput = {
  operationId?: string | null;
  productId?: string | null;
  copyId?: string | null;
  creativeId?: string | null;
  landingId?: string | null;
  campaignId?: string | null;
  sourcePlatform?: string | null;
  country?: string | null;
  language?: string | null;
  niche?: string | null;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  roas?: number | null;
  revenue?: number | null;
  spend?: number | null;
  conversionRate?: number | null;
  status?: GrowthBrainMemoryStatus;
  lesson?: string | null;
  recommendation?: string | null;
  metricType?: GrowthBrainMetricType;
  metadata?: Json;
};

export type GrowthBestCard = {
  label: string;
  score: number;
  lesson: string | null;
  recommendation: string | null;
  entityId: string | null;
  metrics: {
    roas: number | null;
    ctr: number | null;
    revenue: number | null;
    conversionRate: number | null;
  };
};

export type GrowthInsight = {
  id: string;
  title: string;
  summary: string;
  score: number;
  source: string;
};

export type GrowthRecommendation = {
  id: string;
  title: string;
  action: string;
  priority: "high" | "medium" | "low";
  patternType: string;
};

export type GrowthBrainDashboard = {
  melhorCopy: GrowthBestCard | null;
  melhorCriativo: GrowthBestCard | null;
  melhorLanding: GrowthBestCard | null;
  melhorCampanha: GrowthBestCard | null;
  melhorNicho: GrowthBestCard | null;
  melhorPais: GrowthBestCard | null;
  melhorIdioma: GrowthBestCard | null;
  totalMemories: number;
  activeMemories: number;
  avgRoas: number | null;
  avgCtr: number | null;
  insights: GrowthInsight[];
  recommendations: GrowthRecommendation[];
  patterns: GrowthPattern[];
};

function readMetaString(metadata: Json, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readGrowthMetricType(memory: GrowthBrainMemory): GrowthBrainMetricType {
  if (
    memory.metadata &&
    typeof memory.metadata === "object" &&
    !Array.isArray(memory.metadata)
  ) {
    const meta = memory.metadata as Record<string, unknown>;
    if (meta.metric_type === "estimated" || meta.metric_type === "real") {
      return meta.metric_type;
    }
    if (meta.estimated === true) return "estimated";
  }
  return "real";
}

export function isStrongLearningMemory(memory: GrowthBrainMemory): boolean {
  return readGrowthMetricType(memory) === "real";
}

export function computeMemoryScore(memory: GrowthBrainMemory): number {
  const roas = Number(memory.roas ?? 0);
  const ctr = Number(memory.ctr ?? 0);
  const conversion = Number(memory.conversion_rate ?? 0);
  const revenue = Number(memory.revenue ?? 0);
  const spend = Number(memory.spend ?? 0);
  const roiFactor = spend > 0 ? revenue / spend : revenue > 0 ? 1 : 0;

  const base = roas * 40 + ctr * 1000 + conversion * 100 + roiFactor * 20;
  return readGrowthMetricType(memory) === "estimated" ? base * 0.3 : base;
}

function pickBest(
  memories: GrowthBrainMemory[],
  predicate: (memory: GrowthBrainMemory) => boolean,
  labelFn: (memory: GrowthBrainMemory) => string,
  entityIdFn: (memory: GrowthBrainMemory) => string | null
): GrowthBestCard | null {
  const filtered = memories.filter(predicate);
  if (filtered.length === 0) return null;

  const best = filtered.reduce((acc, item) =>
    computeMemoryScore(item) > computeMemoryScore(acc) ? item : acc
  );

  return {
    label: labelFn(best),
    score: Math.round(computeMemoryScore(best)),
    lesson: best.lesson,
    recommendation: best.recommendation,
    entityId: entityIdFn(best),
    metrics: {
      roas: best.roas != null ? Number(best.roas) : null,
      ctr: best.ctr != null ? Number(best.ctr) : null,
      revenue: best.revenue != null ? Number(best.revenue) : null,
      conversionRate: best.conversion_rate != null ? Number(best.conversion_rate) : null,
    },
  };
}

function pickBestGrouped(
  memories: GrowthBrainMemory[],
  keyFn: (memory: GrowthBrainMemory) => string | null
): GrowthBestCard | null {
  const groups = new Map<string, GrowthBrainMemory[]>();

  for (const memory of memories) {
    const key = keyFn(memory);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(memory);
    groups.set(key, list);
  }

  if (groups.size === 0) return null;

  let bestKey = "";
  let bestScore = -Infinity;
  let bestMemories: GrowthBrainMemory[] = [];

  for (const [key, list] of groups) {
    const avgScore =
      list.reduce((sum, item) => sum + computeMemoryScore(item), 0) / list.length;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestKey = key;
      bestMemories = list;
    }
  }

  const representative = bestMemories.reduce((acc, item) =>
    computeMemoryScore(item) > computeMemoryScore(acc) ? item : acc
  );

  return {
    label: bestKey,
    score: Math.round(bestScore),
    lesson: representative.lesson,
    recommendation: representative.recommendation,
    entityId: null,
    metrics: {
      roas: representative.roas != null ? Number(representative.roas) : null,
      ctr: representative.ctr != null ? Number(representative.ctr) : null,
      revenue: representative.revenue != null ? Number(representative.revenue) : null,
      conversionRate:
        representative.conversion_rate != null ? Number(representative.conversion_rate) : null,
    },
  };
}

export function computeGrowthBrainDashboard(
  memories: GrowthBrainMemory[],
  patterns: GrowthPattern[]
): GrowthBrainDashboard {
  const active = memories.filter((m) => m.status === "active");
  const strongLearning = active.filter(isStrongLearningMemory);
  const learningPool = strongLearning.length > 0 ? strongLearning : active;
  const roasValues = learningPool.map((m) => Number(m.roas ?? 0)).filter((v) => v > 0);
  const ctrValues = learningPool.map((m) => Number(m.ctr ?? 0)).filter((v) => v > 0);

  const insights = generateGrowthInsightsFromMemories(learningPool);
  const recommendations = generateRecommendationsFromMemories(learningPool, patterns);

  return {
    melhorCopy: pickBest(
      learningPool,
      (m) => Boolean(m.copy_id),
      (m) => readMetaString(m.metadata, "copy_label") ?? `Copy ${m.copy_id?.slice(0, 8)}`,
      (m) => m.copy_id
    ),
    melhorCriativo: pickBest(
      learningPool,
      (m) => Boolean(m.creative_id),
      (m) => readMetaString(m.metadata, "creative_label") ?? `Criativo ${m.creative_id?.slice(0, 8)}`,
      (m) => m.creative_id
    ),
    melhorLanding: pickBest(
      learningPool,
      (m) => Boolean(m.landing_id),
      (m) => readMetaString(m.metadata, "landing_label") ?? `Landing ${m.landing_id?.slice(0, 8)}`,
      (m) => m.landing_id
    ),
    melhorCampanha: pickBest(
      learningPool,
      (m) => Boolean(m.campaign_id),
      (m) =>
        readMetaString(m.metadata, "campaign_label") ?? `Campanha ${m.campaign_id?.slice(0, 8)}`,
      (m) => m.campaign_id
    ),
    melhorNicho: pickBestGrouped(learningPool, (m) => readMetaString(m.metadata, "niche")),
    melhorPais: pickBestGrouped(learningPool, (m) => m.country),
    melhorIdioma: pickBestGrouped(learningPool, (m) => m.language),
    totalMemories: memories.length,
    activeMemories: active.length,
    avgRoas:
      roasValues.length > 0
        ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length
        : null,
    avgCtr:
      ctrValues.length > 0 ? ctrValues.reduce((a, b) => a + b, 0) / ctrValues.length : null,
    insights,
    recommendations,
    patterns,
  };
}

export function generateGrowthInsightsFromMemories(
  memories: GrowthBrainMemory[]
): GrowthInsight[] {
  if (memories.length === 0) return [];

  const sorted = [...memories].sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a));
  const top = sorted[0];
  const low = sorted[sorted.length - 1];

  const insights: GrowthInsight[] = [
    {
      id: "top-performer",
      title: "Melhor resultado registrado",
      summary:
        top.lesson ??
        `ROAS ${top.roas ?? "—"} · CTR ${top.ctr ?? "—"} · Receita R$ ${top.revenue ?? 0}`,
      score: Math.round(computeMemoryScore(top)),
      source: top.source_platform ?? "aura",
    },
  ];

  if (sorted.length > 1 && computeMemoryScore(low) < computeMemoryScore(top) * 0.5) {
    insights.push({
      id: "underperformer",
      title: "Padrão a evitar",
      summary:
        low.lesson ??
        `Resultado fraco em ${low.source_platform ?? "fonte desconhecida"} — revise criativo e oferta.`,
      score: Math.round(computeMemoryScore(low)),
      source: low.source_platform ?? "aura",
    });
  }

  const platforms = new Map<string, number>();
  for (const memory of memories) {
    const key = memory.source_platform ?? "manual";
    platforms.set(key, (platforms.get(key) ?? 0) + computeMemoryScore(memory));
  }

  const bestPlatform = [...platforms.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestPlatform) {
    insights.push({
      id: "best-platform",
      title: "Plataforma mais eficiente",
      summary: `${bestPlatform[0]} concentra os melhores resultados acumulados.`,
      score: Math.round(bestPlatform[1]),
      source: bestPlatform[0],
    });
  }

  return insights.slice(0, 6);
}

export function generateRecommendationsFromMemories(
  memories: GrowthBrainMemory[],
  patterns: GrowthPattern[]
): GrowthRecommendation[] {
  const recommendations: GrowthRecommendation[] = [];

  for (const pattern of patterns.slice(0, 4)) {
    recommendations.push({
      id: pattern.id,
      title: `Padrão ${pattern.pattern_type}`,
      action: pattern.recommendation ?? pattern.lesson ?? "Repita o padrão vencedor.",
      priority: Number(pattern.score) >= 70 ? "high" : Number(pattern.score) >= 40 ? "medium" : "low",
      patternType: pattern.pattern_type,
    });
  }

  const best = [...memories].sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
  if (best?.recommendation) {
    recommendations.unshift({
      id: `memory-${best.id}`,
      title: "Recomendação da memória top",
      action: best.recommendation,
      priority: "high",
      patternType: "performance",
    });
  }

  if (recommendations.length === 0 && memories.length > 0) {
    recommendations.push({
      id: "collect-more",
      title: "Continue alimentando o Growth Brain",
      action: "Registre mais vendas, cliques e campanhas para gerar padrões confiáveis.",
      priority: "medium",
      patternType: "learning",
    });
  }

  return recommendations.slice(0, 8);
}

export function buildGrowthBrainAuraContext(dashboard: GrowthBrainDashboard): string {
  const lines = [
    "## GROWTH BRAIN",
    `Memórias ativas: ${dashboard.activeMemories}/${dashboard.totalMemories}`,
    dashboard.avgRoas != null ? `ROAS médio: ${dashboard.avgRoas.toFixed(2)}` : null,
    dashboard.melhorCampanha
      ? `Melhor campanha: ${dashboard.melhorCampanha.label} (score ${dashboard.melhorCampanha.score})`
      : null,
    dashboard.melhorNicho ? `Melhor nicho: ${dashboard.melhorNicho.label}` : null,
    dashboard.insights[0] ? `Insight: ${dashboard.insights[0].summary}` : null,
    dashboard.recommendations[0]
      ? `Recomendação: ${dashboard.recommendations[0].action}`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}
