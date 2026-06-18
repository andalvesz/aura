import type {
  FinancialIncome,
  Gasto,
  GrowthLead,
  KiwifySale,
  MetaCampaignMetric,
} from "@/types/database";
import { formatBRL } from "@/utils/format";

export type RevenueSourceId =
  | "kiwify"
  | "meta_ads"
  | "alvesz"
  | "consorcios"
  | "outras";

export type ExpenseSourceId =
  | "meta_ads"
  | "ferramentas"
  | "openai"
  | "cursor"
  | "vercel"
  | "outros";

export type RevenuePeriodTotals = {
  today: number;
  week: number;
  month: number;
  total: number;
};

export type RevenueSourceMetrics = RevenuePeriodTotals & {
  id: RevenueSourceId;
  label: string;
};

export type ExpenseSourceMetrics = RevenuePeriodTotals & {
  id: ExpenseSourceId;
  label: string;
};

export type RevenueProfitMetrics = {
  receita: RevenuePeriodTotals;
  despesas: RevenuePeriodTotals;
  lucroLiquido: RevenuePeriodTotals;
  roiPct: number;
  roas: number | null;
  margemPct: number;
  investimentoSugerido: number;
  metaAdsSugerido: number;
};

export type RevenueDashboardMetrics = {
  receitas: RevenueSourceMetrics[];
  despesas: ExpenseSourceMetrics[];
  resumo: RevenuePeriodTotals;
  lucro: RevenueProfitMetrics;
};

export const REVENUE_SOURCES: { id: RevenueSourceId; label: string }[] = [
  { id: "kiwify", label: "Kiwify" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "alvesz", label: "Alvesz Experience" },
  { id: "consorcios", label: "Consórcios" },
  { id: "outras", label: "Outras receitas" },
];

export const EXPENSE_SOURCES: { id: ExpenseSourceId; label: string }[] = [
  { id: "meta_ads", label: "Meta Ads" },
  { id: "ferramentas", label: "Ferramentas" },
  { id: "openai", label: "OpenAI" },
  { id: "cursor", label: "Cursor" },
  { id: "vercel", label: "Vercel" },
  { id: "outros", label: "Outros" },
];

type DatedAmount = { date: string; amount: number };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(text: string, patterns: readonly string[]): boolean {
  const n = normalize(text);
  return patterns.some((p) => n.includes(normalize(p)));
}

function isPaidKiwifySale(status: string): boolean {
  const s = status.toLowerCase();
  return s === "paid" || s === "approved" || s === "completed" || s === "pago";
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(): Date {
  const today = startOfToday();
  const day = today.getDay();
  const diff = day === 0 ? 6 : day - 1;
  today.setDate(today.getDate() - diff);
  return today;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

function inPeriod(date: string, period: keyof RevenuePeriodTotals): boolean {
  const d = parseDate(date);
  const now = new Date();
  if (period === "total") return true;
  if (period === "today") return d >= startOfToday();
  if (period === "week") return d >= startOfWeek();
  if (period === "month") return d >= startOfMonth();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function sumByPeriod(items: DatedAmount[]): RevenuePeriodTotals {
  return {
    today: items.filter((i) => inPeriod(i.date, "today")).reduce((s, i) => s + i.amount, 0),
    week: items.filter((i) => inPeriod(i.date, "week")).reduce((s, i) => s + i.amount, 0),
    month: items.filter((i) => inPeriod(i.date, "month")).reduce((s, i) => s + i.amount, 0),
    total: items.reduce((s, i) => s + i.amount, 0),
  };
}

export function classifyIncomeSource(income: FinancialIncome): RevenueSourceId {
  const text = `${income.descricao} ${income.origem}`;
  if (income.origem === "alvesz") return "alvesz";
  if (income.origem === "consorcios") return "consorcios";
  if (
    matchesAny(text, ["meta ads", "meta", "facebook", "instagram ads", "trafego pago"])
  ) {
    return "meta_ads";
  }
  if (matchesAny(text, ["kiwify", "hotmart", "eduzz"])) return "outras";
  return "outras";
}

export function classifyExpenseSource(gasto: Gasto): ExpenseSourceId {
  const text = `${gasto.titulo} ${gasto.categoria}`;
  if (matchesAny(text, ["meta ads", "meta", "facebook ads", "instagram ads", "anuncio", "anúncio", "trafego"])) {
    return "meta_ads";
  }
  if (matchesAny(text, ["openai", "chatgpt", "gpt-4", "gpt4"])) return "openai";
  if (matchesAny(text, ["cursor"])) return "cursor";
  if (matchesAny(text, ["vercel"])) return "vercel";
  if (
    matchesAny(text, [
      "ferramenta",
      "saas",
      "software",
      "assinatura",
      "notion",
      "canva",
      "supabase",
      "github",
    ]) ||
    gasto.categoria === "equipamentos" ||
    gasto.categoria === "empresa"
  ) {
    return "ferramentas";
  }
  return "outros";
}

function kiwifySaleAmount(sale: KiwifySale): number {
  return sale.net_cents / 100;
}

function kiwifySaleDate(sale: KiwifySale): string {
  return sale.sold_at.slice(0, 10);
}

function metaMetricAmount(metric: MetaCampaignMetric): number {
  return metric.spend_cents / 100;
}

function leadRevenueAmount(lead: GrowthLead): number {
  return Number(lead.valor_potencial) || 0;
}

function leadRevenueDate(lead: GrowthLead): string {
  return lead.updated_at.slice(0, 10);
}

export type RevenueComputeInput = {
  kiwifySales: KiwifySale[];
  income: FinancialIncome[];
  gastos: Gasto[];
  metaMetrics: MetaCampaignMetric[];
  growthLeads: GrowthLead[];
};

export function computeRevenueDashboard(input: RevenueComputeInput): RevenueDashboardMetrics {
  const revenueItems: Record<RevenueSourceId, DatedAmount[]> = {
    kiwify: [],
    meta_ads: [],
    alvesz: [],
    consorcios: [],
    outras: [],
  };

  for (const sale of input.kiwifySales.filter((s) => isPaidKiwifySale(s.status))) {
    revenueItems.kiwify.push({
      date: kiwifySaleDate(sale),
      amount: kiwifySaleAmount(sale),
    });
  }

  for (const income of input.income) {
    const source = classifyIncomeSource(income);
    if (source === "meta_ads" || source === "alvesz" || source === "consorcios" || source === "outras") {
      revenueItems[source].push({ date: income.data, amount: Number(income.valor) });
    }
  }

  for (const lead of input.growthLeads.filter((l) => l.status === "fechado")) {
    const amount = leadRevenueAmount(lead);
    if (amount <= 0) continue;
    const item = { date: leadRevenueDate(lead), amount };
    if (lead.vertical === "consorcios") {
      revenueItems.consorcios.push(item);
    } else if (lead.vertical === "alvesz") {
      revenueItems.alvesz.push(item);
    } else if (lead.canal === "instagram") {
      revenueItems.meta_ads.push(item);
    } else {
      revenueItems.outras.push(item);
    }
  }

  const expenseItems: Record<ExpenseSourceId, DatedAmount[]> = {
    meta_ads: [],
    ferramentas: [],
    openai: [],
    cursor: [],
    vercel: [],
    outros: [],
  };

  for (const gasto of input.gastos) {
    const source = classifyExpenseSource(gasto);
    expenseItems[source].push({ date: gasto.data, amount: Number(gasto.valor) });
  }

  for (const metric of input.metaMetrics) {
    expenseItems.meta_ads.push({
      date: metric.metrics_date,
      amount: metaMetricAmount(metric),
    });
  }

  const receitas = REVENUE_SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    ...sumByPeriod(revenueItems[source.id]),
  }));

  const despesas = EXPENSE_SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    ...sumByPeriod(expenseItems[source.id]),
  }));

  const resumoReceita = sumByPeriod(
    Object.values(revenueItems).flat()
  );
  const resumoDespesa = sumByPeriod(
    Object.values(expenseItems).flat()
  );

  const lucroLiquido: RevenuePeriodTotals = {
    today: resumoReceita.today - resumoDespesa.today,
    week: resumoReceita.week - resumoDespesa.week,
    month: resumoReceita.month - resumoDespesa.month,
    total: resumoReceita.total - resumoDespesa.total,
  };

  const roiPct =
    resumoDespesa.month > 0
      ? Math.round((lucroLiquido.month / resumoDespesa.month) * 100)
      : lucroLiquido.month > 0
        ? 100
        : 0;

  const roas =
    resumoDespesa.month > 0
      ? Math.round((resumoReceita.month / resumoDespesa.month) * 10000) / 10000
      : resumoReceita.month > 0
        ? null
        : 0;

  const margemPct =
    resumoReceita.month > 0
      ? Math.round((lucroLiquido.month / resumoReceita.month) * 100)
      : 0;

  const investimentoSugerido = Math.max(0, Math.round(lucroLiquido.month * 0.35));
  const metaAdsSugerido = Math.max(0, Math.round(lucroLiquido.month * 0.25));

  return {
    receitas,
    despesas,
    resumo: resumoReceita,
    lucro: {
      receita: resumoReceita,
      despesas: resumoDespesa,
      lucroLiquido,
      roiPct,
      roas,
      margemPct,
      investimentoSugerido,
      metaAdsSugerido,
    },
  };
}

export function buildRevenueAuraContext(metrics: RevenueDashboardMetrics): string {
  const lines = [
    "## AURA REVENUE CENTER",
    `Receita hoje: ${formatBRL(metrics.resumo.today)}`,
    `Receita semana: ${formatBRL(metrics.resumo.week)}`,
    `Receita mês: ${formatBRL(metrics.resumo.month)}`,
    `Receita total: ${formatBRL(metrics.resumo.total)}`,
    `Despesas mês: ${formatBRL(metrics.lucro.despesas.month)}`,
    `Lucro líquido mês: ${formatBRL(metrics.lucro.lucroLiquido.month)}`,
    `ROI: ${metrics.lucro.roiPct}%`,
    `ROAS: ${metrics.lucro.roas != null ? `${metrics.lucro.roas}x` : "—"}`,
    `Margem: ${metrics.lucro.margemPct}%`,
    `Investimento sugerido: ${formatBRL(metrics.lucro.investimentoSugerido)}`,
    `Meta Ads sugerido: ${formatBRL(metrics.lucro.metaAdsSugerido)}`,
    "",
    "Receitas por fonte (mês):",
    ...metrics.receitas.map((r) => `- ${r.label}: ${formatBRL(r.month)}`),
    "",
    "Despesas por categoria (mês):",
    ...metrics.despesas.map((d) => `- ${d.label}: ${formatBRL(d.month)}`),
  ];
  return lines.join("\n");
}

const REVENUE_PROFIT_MONTH_PHRASES = [
  "quanto lucrei esse mes",
  "quanto lucrei este mes",
  "quanto lucrei no mes",
  "lucro do mes",
  "lucro liquido",
  "quanto ganhei esse mes",
] as const;

const REVENUE_INVESTABLE_PHRASES = [
  "quanto posso investir",
  "quanto devo investir",
  "quanto tenho para investir",
  "orcamento para investir",
] as const;

const REVENUE_META_BUDGET_PHRASES = [
  "quanto devo colocar no meta ads",
  "quanto investir no meta",
  "quanto colocar no meta ads",
  "orcamento meta ads",
  "budget meta ads",
] as const;

const REVENUE_MARGIN_PHRASES = [
  "qual minha margem",
  "minha margem",
  "margem de lucro",
  "qual a margem",
] as const;

export type RevenueCoachMode =
  | "revenue-profit-month"
  | "revenue-investable"
  | "revenue-meta-budget"
  | "revenue-margin";

export function detectRevenueCoachMode(message: string): RevenueCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, REVENUE_MARGIN_PHRASES)) return "revenue-margin";
  if (matchesAny(normalized, REVENUE_META_BUDGET_PHRASES)) return "revenue-meta-budget";
  if (matchesAny(normalized, REVENUE_INVESTABLE_PHRASES)) return "revenue-investable";
  if (matchesAny(normalized, REVENUE_PROFIT_MONTH_PHRASES)) return "revenue-profit-month";
  return null;
}

export function buildRevenueCoachReply(params: {
  mode: RevenueCoachMode;
  displayName: string;
  metrics: RevenueDashboardMetrics;
}): string {
  const { mode, displayName, metrics } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;
  const { lucro, resumo } = metrics;

  switch (mode) {
    case "revenue-profit-month":
      return `${firstName}, seu **lucro líquido este mês** é **${formatBRL(lucro.lucroLiquido.month)}**.

**Receita:** ${formatBRL(resumo.month)}
**Despesas:** ${formatBRL(lucro.despesas.month)}
**Margem:** ${lucro.margemPct}%
**ROI:** ${lucro.roiPct}%

Veja o detalhamento completo em /dashboard/revenue.`;

    case "revenue-investable":
      return `${firstName}, com lucro líquido de **${formatBRL(lucro.lucroLiquido.month)}** este mês, você pode investir com segurança até **${formatBRL(lucro.investimentoSugerido)}** (≈35% do lucro).

Regra prática: mantenha reserva para despesas fixas e escale apenas o que já converte.

Painel completo: /dashboard/revenue`;

    case "revenue-meta-budget":
      return `${firstName}, para Meta Ads este mês, a Aura sugere **${formatBRL(lucro.metaAdsSugerido)}** (≈25% do lucro líquido).

**Contexto:**
- Receita Meta Ads: ${formatBRL(metrics.receitas.find((r) => r.id === "meta_ads")?.month ?? 0)}
- Gasto Meta Ads: ${formatBRL(metrics.despesas.find((d) => d.id === "meta_ads")?.month ?? 0)}
- ROI geral: ${lucro.roiPct}%

Ajuste conforme ROAS das campanhas em /dashboard/platforms/meta.`;

    case "revenue-margin":
      return `${firstName}, sua **margem líquida** este mês é **${lucro.margemPct}%**.

**Receita:** ${formatBRL(resumo.month)}
**Despesas:** ${formatBRL(lucro.despesas.month)}
**Lucro:** ${formatBRL(lucro.lucroLiquido.month)}

${lucro.margemPct >= 30 ? "Margem saudável — considere reinvestir em tráfego e produtos campeões." : lucro.margemPct >= 15 ? "Margem moderada — revise despesas recorrentes e otimize campanhas." : "Margem apertada — priorize cortar custos fixos e focar no que já vende."}`;
  }
}
