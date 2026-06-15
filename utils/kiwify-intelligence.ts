import type {
  KiwifyCommission,
  KiwifyConnection,
  KiwifyProduct,
  KiwifySale,
  MoneyMissionPlan,
} from "@/types/database";
import { formatIntegrationCents, INTEGRATION_SYNC_INTERVAL_MS } from "@/utils/integrations";

export const KIWIFY_SYNC_INTERVAL_MS = INTEGRATION_SYNC_INTERVAL_MS;

export type KiwifyTopProduct = {
  id: string;
  name: string;
  salesCount: number;
  revenueCents: number;
};

export type KiwifyIntelligenceMetrics = {
  revenueTotalCents: number;
  revenueMonthCents: number;
  salesTodayCount: number;
  salesTodayCents: number;
  activeProducts: number;
  topSellingProducts: KiwifyTopProduct[];
  averageTicketCents: number;
  conversionPct: number;
  commissionsCents: number;
  estimatedRoiPct: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
};

export type KiwifyPerformanceInsight = {
  type: "growth" | "decline" | "promising" | "stalled" | "seasonality";
  title: string;
  summary: string;
  recommendation: string;
  severity: "info" | "warning" | "success";
};

export type KiwifyCreatorComparison = {
  potencial: number;
  risco: number;
  alinhamentoLegado: number;
  chanceVenda: number;
  resumo: string;
  produtosReferencia: { name: string; revenueCents: number; nota: string }[];
};

export type KiwifyCoachMode =
  | "kiwify-sales-today"
  | "kiwify-best-product"
  | "kiwify-scale-product"
  | "kiwify-monthly-revenue"
  | "kiwify-goal-gap";

const KIWIFY_SALES_TODAY_PHRASES = [
  "quanto vendi hoje",
  "vendas de hoje",
  "vendi hoje",
  "faturamento de hoje",
  "receita de hoje",
] as const;

const KIWIFY_BEST_PRODUCT_PHRASES = [
  "qual produto esta melhor",
  "qual produto está melhor",
  "produto esta melhor",
  "produto está melhor",
  "melhor produto kiwify",
  "produto que mais vende",
] as const;

const KIWIFY_SCALE_PRODUCT_PHRASES = [
  "qual produto devo escalar",
  "produto devo escalar",
  "que produto escalar",
  "escalar produto",
] as const;

const KIWIFY_MONTHLY_REVENUE_PHRASES = [
  "qual meu faturamento mensal",
  "faturamento mensal",
  "receita do mes",
  "receita do mês",
  "quanto faturei no mes",
  "quanto faturei no mês",
] as const;

const KIWIFY_GOAL_GAP_PHRASES = [
  "quanto falta para minha meta",
  "quanto falta para meta",
  "falta para meta",
  "distancia da meta",
  "distância da meta",
] as const;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => text.includes(normalize(p)));
}

function isPaidSale(status: string): boolean {
  const s = status.toLowerCase();
  return s === "paid" || s === "approved" || s === "completed" || s === "pago";
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function computeNextSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) return null;
  return new Date(new Date(lastSyncAt).getTime() + KIWIFY_SYNC_INTERVAL_MS).toISOString();
}

export function shouldAutoSyncKiwify(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return true;
  return Date.now() - new Date(lastSyncAt).getTime() >= KIWIFY_SYNC_INTERVAL_MS;
}

function aggregateTopProducts(sales: KiwifySale[]): KiwifyTopProduct[] {
  const map = new Map<string, KiwifyTopProduct>();

  for (const sale of sales.filter((s) => isPaidSale(s.status))) {
    const key = sale.external_product_id ?? sale.product_name ?? sale.id;
    const name = sale.product_name ?? "Produto";
    const existing = map.get(key);
    if (existing) {
      existing.salesCount += 1;
      existing.revenueCents += sale.net_cents;
    } else {
      map.set(key, {
        id: key,
        name,
        salesCount: 1,
        revenueCents: sale.net_cents,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
}

export function computeKiwifyIntelligenceMetrics(params: {
  products: KiwifyProduct[];
  sales: KiwifySale[];
  commissions: KiwifyCommission[];
  connection: KiwifyConnection | null;
}): KiwifyIntelligenceMetrics {
  const { products, sales, commissions, connection } = params;
  const paidSales = sales.filter((s) => isPaidSale(s.status));
  const monthStart = startOfMonthIso();
  const todayStart = startOfTodayIso();

  const salesMonth = paidSales.filter((s) => s.sold_at >= monthStart);
  const salesToday = paidSales.filter((s) => s.sold_at >= todayStart);

  const revenueTotalCents = paidSales.reduce((sum, s) => sum + s.net_cents, 0);
  const revenueMonthCents = salesMonth.reduce((sum, s) => sum + s.net_cents, 0);
  const salesTodayCents = salesToday.reduce((sum, s) => sum + s.net_cents, 0);
  const commissionsCents = commissions.reduce((sum, c) => sum + c.amount_cents, 0);

  const activeProducts = products.filter(
    (p) => p.status === "active" || p.status === "published" || p.status === "ativo"
  ).length;

  const topSellingProducts = aggregateTopProducts(paidSales);
  const averageTicketCents =
    paidSales.length > 0 ? Math.round(revenueTotalCents / paidSales.length) : 0;

  const conversionPct =
    products.length > 0
      ? Math.min(100, Math.round((paidSales.length / products.length) * 100))
      : 0;

  const estimatedRoiPct =
    commissionsCents > 0
      ? Math.round(((revenueMonthCents - commissionsCents) / commissionsCents) * 100)
      : revenueMonthCents > 0
        ? 100
        : 0;

  const lastSyncAt = connection?.last_sync_at ?? null;

  return {
    revenueTotalCents,
    revenueMonthCents,
    salesTodayCount: salesToday.length,
    salesTodayCents,
    activeProducts: activeProducts || products.length,
    topSellingProducts,
    averageTicketCents,
    conversionPct,
    commissionsCents,
    estimatedRoiPct,
    lastSyncAt,
    nextSyncAt: computeNextSyncAt(lastSyncAt),
  };
}

export function generateKiwifyPerformanceInsights(params: {
  metrics: KiwifyIntelligenceMetrics;
  products: KiwifyProduct[];
  sales: KiwifySale[];
}): KiwifyPerformanceInsight[] {
  const { metrics, products, sales } = params;
  const insights: KiwifyPerformanceInsight[] = [];
  const paidSales = sales.filter((s) => isPaidSale(s.status));

  const weekStart = daysAgoIso(7);
  const prevWeekStart = daysAgoIso(14);
  const thisWeek = paidSales.filter((s) => s.sold_at >= weekStart);
  const lastWeek = paidSales.filter(
    (s) => s.sold_at >= prevWeekStart && s.sold_at < weekStart
  );
  const thisWeekRev = thisWeek.reduce((sum, s) => sum + s.net_cents, 0);
  const lastWeekRev = lastWeek.reduce((sum, s) => sum + s.net_cents, 0);

  if (lastWeekRev > 0) {
    const changePct = Math.round(((thisWeekRev - lastWeekRev) / lastWeekRev) * 100);
    if (changePct >= 10) {
      insights.push({
        type: "growth",
        title: "Crescimento nas vendas",
        summary: `Receita semanal subiu ${changePct}% vs semana anterior.`,
        recommendation: "Mantenha o funil ativo e considere aumentar tráfego nos produtos líderes.",
        severity: "success",
      });
    } else if (changePct <= -20) {
      insights.push({
        type: "decline",
        title: "Queda nas vendas",
        summary: `Receita semanal caiu ${Math.abs(changePct)}% vs semana anterior.`,
        recommendation: "Revise criativos, oferta e remarketing dos produtos com maior queda.",
        severity: "warning",
      });
    }
  }

  const soldProductIds = new Set(
    paidSales.map((s) => s.external_product_id).filter(Boolean) as string[]
  );
  const promising = products
    .filter((p) => p.affiliate_enabled && (p.affiliate_score ?? 0) >= 70)
    .filter((p) => !soldProductIds.has(p.external_product_id))
    .slice(0, 2);

  for (const product of promising) {
    insights.push({
      type: "promising",
      title: "Produto promissor",
      summary: `${product.name} tem score ${product.affiliate_score ?? 0} mas ainda poucas vendas registradas.`,
      recommendation: "Teste tráfego pago ou parcerias de afiliados neste produto.",
      severity: "info",
    });
  }

  const stalled = products
    .filter((p) => p.status === "active" || p.status === "published" || p.status === "ativo")
    .filter((p) => !soldProductIds.has(p.external_product_id))
    .slice(0, 2);

  for (const product of stalled) {
    insights.push({
      type: "stalled",
      title: "Produto parado",
      summary: `${product.name} está ativo sem vendas no período analisado.`,
      recommendation: "Atualize página de vendas, preço ou pause para focar no que converte.",
      severity: "warning",
    });
  }

  const weekdayRev = paidSales
    .filter((s) => {
      const day = new Date(s.sold_at).getDay();
      return day >= 1 && day <= 5;
    })
    .reduce((sum, s) => sum + s.net_cents, 0);
  const weekendRev = paidSales
    .filter((s) => {
      const day = new Date(s.sold_at).getDay();
      return day === 0 || day === 6;
    })
    .reduce((sum, s) => sum + s.net_cents, 0);

  if (weekdayRev > 0 || weekendRev > 0) {
    const stronger =
      weekendRev > weekdayRev * 1.2
        ? "fins de semana"
        : weekdayRev > weekendRev * 1.2
          ? "dias úteis"
          : null;
    if (stronger) {
      insights.push({
        type: "seasonality",
        title: "Sazonalidade detectada",
        summary: `Maior concentração de vendas nos ${stronger}.`,
        recommendation: `Programe campanhas e lives nos ${stronger} para maximizar conversão.`,
        severity: "info",
      });
    }
  }

  if (insights.length === 0 && metrics.revenueTotalCents > 0) {
    insights.push({
      type: "growth",
      title: "Operação estável",
      summary: "Vendas consistentes sem alertas críticos no período.",
      recommendation: "Escale o produto líder e teste upsells nos compradores recentes.",
      severity: "success",
    });
  }

  return insights.slice(0, 6);
}

export function detectKiwifyCoachMode(message: string): KiwifyCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, KIWIFY_SALES_TODAY_PHRASES)) return "kiwify-sales-today";
  if (matchesAny(normalized, KIWIFY_BEST_PRODUCT_PHRASES)) return "kiwify-best-product";
  if (matchesAny(normalized, KIWIFY_SCALE_PRODUCT_PHRASES)) return "kiwify-scale-product";
  if (matchesAny(normalized, KIWIFY_MONTHLY_REVENUE_PHRASES)) return "kiwify-monthly-revenue";
  if (matchesAny(normalized, KIWIFY_GOAL_GAP_PHRASES)) return "kiwify-goal-gap";
  return null;
}

export function buildKiwifyCoachReply(params: {
  mode: KiwifyCoachMode;
  displayName: string;
  metrics: KiwifyIntelligenceMetrics | null;
  connected: boolean;
  moneyPlan: MoneyMissionPlan | null;
}): string {
  const { mode, displayName, metrics, connected, moneyPlan } = params;

  if (!connected || !metrics) {
    return `Olá, ${displayName}!

Conecte a Kiwify em **Kiwify Intelligence** (/dashboard/platforms/kiwify) para eu analisar vendas reais.`;
  }

  if (mode === "kiwify-sales-today") {
    return `Olá, ${displayName}!

**Vendas de hoje (Kiwify):**
- ${metrics.salesTodayCount} venda(s)
- Receita: ${formatIntegrationCents(metrics.salesTodayCents)}

${metrics.salesTodayCount === 0 ? "Ainda sem vendas hoje — considere ativar tráfego ou remarketing." : "Bom ritmo — acompanhe o produto líder no dashboard."}`;
  }

  if (mode === "kiwify-best-product") {
    const top = metrics.topSellingProducts[0];
    if (!top) {
      return `Olá, ${displayName}!

Ainda não há produtos com vendas registradas. Sincronize a Kiwify e aguarde novas vendas.`;
    }
    return `Olá, ${displayName}!

**Produto que mais vende:** ${top.name}
- ${top.salesCount} venda(s)
- Receita: ${formatIntegrationCents(top.revenueCents)}

Ticket médio geral: ${formatIntegrationCents(metrics.averageTicketCents)}`;
  }

  if (mode === "kiwify-scale-product") {
    const candidate =
      metrics.topSellingProducts.find((p) => p.salesCount >= 2) ?? metrics.topSellingProducts[0];
    if (!candidate) {
      return `Olá, ${displayName}!

Sem histórico suficiente. Priorize validar oferta e tráfego no produto com maior score de afiliação.`;
    }
    return `Olá, ${displayName}!

**Produto para escalar:** ${candidate.name}
- Receita: ${formatIntegrationCents(candidate.revenueCents)}
- ROI estimado: ${metrics.estimatedRoiPct}%

Próximo passo: aumentar investimento em tráfego e criar variações de criativo para este produto.`;
  }

  if (mode === "kiwify-monthly-revenue") {
    return `Olá, ${displayName}!

**Faturamento mensal (Kiwify):** ${formatIntegrationCents(metrics.revenueMonthCents)}
- Comissões: ${formatIntegrationCents(metrics.commissionsCents)}
- Ticket médio: ${formatIntegrationCents(metrics.averageTicketCents)}
- Conversão estimada: ${metrics.conversionPct}%`;
  }

  if (mode === "kiwify-goal-gap") {
    const meta = moneyPlan ? Number(moneyPlan.valor_meta) : 0;
    const conquistado = metrics.revenueMonthCents / 100;
    if (meta <= 0) {
      return `Olá, ${displayName}!

Receita Kiwify no mês: ${formatIntegrationCents(metrics.revenueMonthCents)}

Defina uma meta em **Money Missions** (/dashboard/money) para eu calcular quanto falta.`;
    }
    const faltam = Math.max(0, meta - conquistado);
    return `Olá, ${displayName}!

**Meta:** R$ ${meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
**Conquistado (Kiwify):** R$ ${conquistado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
**Faltam:** R$ ${faltam.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

Progresso: ${Math.min(100, Math.round((conquistado / meta) * 100))}%`;
  }

  return `Olá, ${displayName}! Consulte o dashboard Kiwify Intelligence para métricas detalhadas.`;
}

export function buildKiwifyAuraContext(params: {
  metrics: KiwifyIntelligenceMetrics;
  insights: KiwifyPerformanceInsight[];
  connected: boolean;
  operationContext?: string;
}): string {
  const { metrics, insights, connected, operationContext } = params;
  if (!connected) return "Kiwify não conectada.";

  const lines = [
    "## KIWIFY INTELLIGENCE",
    `Receita total: ${formatIntegrationCents(metrics.revenueTotalCents)}`,
    `Receita mês: ${formatIntegrationCents(metrics.revenueMonthCents)}`,
    `Vendas hoje: ${metrics.salesTodayCount} (${formatIntegrationCents(metrics.salesTodayCents)})`,
    `Produtos ativos: ${metrics.activeProducts}`,
    `Ticket médio: ${formatIntegrationCents(metrics.averageTicketCents)}`,
    `Conversão: ${metrics.conversionPct}%`,
    `Comissões: ${formatIntegrationCents(metrics.commissionsCents)}`,
    `ROI estimado: ${metrics.estimatedRoiPct}%`,
  ];

  if (metrics.topSellingProducts.length > 0) {
    lines.push(
      `Top produtos: ${metrics.topSellingProducts
        .slice(0, 3)
        .map((p) => `${p.name} (${formatIntegrationCents(p.revenueCents)})`)
        .join(", ")}`
    );
  }

  if (insights.length > 0) {
    lines.push(
      "Insights:",
      ...insights.slice(0, 4).map((i) => `- ${i.title}: ${i.summary} → ${i.recommendation}`)
    );
  }

  if (operationContext) {
    lines.push("Operação ativa:", operationContext);
  }

  return lines.join("\n");
}

export function buildKiwifyMoneyMissionBlock(params: {
  metrics: KiwifyIntelligenceMetrics;
  plan: MoneyMissionPlan | null;
}): string {
  const { metrics, plan } = params;
  const conquistado = metrics.revenueMonthCents / 100;
  const meta = plan ? Number(plan.valor_meta) : 0;
  const faltam = meta > 0 ? Math.max(0, meta - conquistado) : 0;

  const lines = [
    "## KIWIFY → MONEY MISSIONS",
    `Receita Kiwify (mês): R$ ${conquistado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  ];

  if (meta > 0) {
    lines.push(
      `Meta ativa: R$ ${meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Conquistado (Kiwify): R$ ${conquistado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Faltam: R$ ${faltam.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
  }

  return lines.join("\n");
}

export function compareCreatorWithKiwifyCatalog(params: {
  productName: string;
  nicho: string;
  precoMin: number;
  precoMax: number;
  probabilidadeVenda: number;
  legacyContext?: string | null;
  kiwifyProducts: KiwifyProduct[];
  topSelling: KiwifyTopProduct[];
}): KiwifyCreatorComparison {
  const {
    productName,
    nicho,
    precoMin,
    precoMax,
    probabilidadeVenda,
    legacyContext,
    kiwifyProducts,
    topSelling,
  } = params;

  const avgPrice =
    kiwifyProducts.length > 0
      ? kiwifyProducts.reduce((sum, p) => sum + (p.price_cents ?? 0), 0) /
        kiwifyProducts.length /
        100
      : 197;

  const priceMid = (precoMin + precoMax) / 2;
  const priceFit = avgPrice > 0 ? 100 - Math.min(100, Math.abs(priceMid - avgPrice) / avgPrice * 100) : 50;

  const nicheWords = normalize(`${nicho} ${productName}`).split(/\s+/).filter((w) => w.length > 3);
  const matches = kiwifyProducts.filter((p) => {
    const name = normalize(p.name);
    return nicheWords.some((w) => name.includes(w));
  });

  const referenceProducts = (topSelling.length > 0 ? topSelling : matches.map((p) => ({
    id: p.external_product_id,
    name: p.name,
    salesCount: 0,
    revenueCents: p.price_cents ?? 0,
  }))).slice(0, 3);

  const marketProof = topSelling.length > 0 ? Math.min(100, topSelling[0].salesCount * 15 + 40) : 35;
  const potencial = Math.round((priceFit * 0.3 + marketProof * 0.4 + probabilidadeVenda * 0.3));
  const risco = Math.round(100 - potencial * 0.7 - (matches.length > 0 ? 10 : 0));

  let alinhamentoLegado = 60;
  if (legacyContext) {
    const legacyNorm = normalize(legacyContext);
    const overlap = nicheWords.filter((w) => legacyNorm.includes(w)).length;
    alinhamentoLegado = Math.min(100, 50 + overlap * 15);
  }

  const chanceVenda = Math.round((potencial * 0.5 + alinhamentoLegado * 0.3 + probabilidadeVenda * 0.2));

  const resumo =
    referenceProducts.length > 0
      ? `Comparado ao catálogo Kiwify, "${productName}" tem potencial ${potencial}/100. Referência: ${referenceProducts[0].name}.`
      : `Sem catálogo Kiwify sincronizado — estimativa baseada no perfil do produto.`;

  return {
    potencial,
    risco: Math.max(5, Math.min(95, risco)),
    alinhamentoLegado,
    chanceVenda,
    resumo,
    produtosReferencia: referenceProducts.map((p) => ({
      name: p.name,
      revenueCents: p.revenueCents,
      nota: p.salesCount > 0 ? `${p.salesCount} vendas` : "catálogo existente",
    })),
  };
}
