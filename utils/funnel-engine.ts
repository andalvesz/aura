import type { Funnel, FunnelStep, FunnelStepType, FunnelType, Json } from "@/types/database";

export const FUNNEL_ENGINE_SAFE_MODE = {
  active: true,
  message:
    "Funnel Engine gera funis em rascunho — revise bumps, upsells e downsells antes de ativar.",
};

export type FunnelStepStatus = FunnelStep["status"];

export type FunnelStepPricing = {
  step_type: FunnelStepType;
  price: number;
  take_rate: number;
};

export type GeneratedFunnelOffer = {
  step_type: FunnelStepType;
  nome: string;
  headline: string;
  promessa: string;
  preco: number;
  preco_original?: number;
  bullets: string[];
  cta: string;
  take_rate_hint: number;
  rationale: string;
};

export type FunnelEngineIntake = {
  product_id: string;
  operation_id?: string | null;
  copylab_id?: string | null;
  factory_id?: string | null;
  funnel_name?: string;
  niche?: string;
  funnel_type?: FunnelType;
  front_price?: number;
  auto_generate_landing?: boolean;
};

export type FunnelMapNode = {
  step_type: FunnelStepType;
  step_order: number;
  label: string;
  price: number | null;
  take_rate: number | null;
  expected_revenue: number | null;
  status: FunnelStepStatus;
  links: {
    product_id: string | null;
    landing_id: string | null;
    copy_id: string | null;
    creative_id: string | null;
    offer_id: string | null;
  };
};

export type FunnelMap = {
  funnel_id: string;
  funnel_name: string;
  funnel_type: FunnelType;
  niche: string | null;
  total_steps: number;
  expected_aov: number;
  expected_conversion: number;
  nodes: FunnelMapNode[];
  flow: string[];
  summary: string;
};

export type FunnelBundle = {
  funnel: Funnel;
  steps: FunnelStep[];
  map: FunnelMap;
};

export type FunnelEngineDashboardMetrics = {
  total: number;
  ready: number;
  active: number;
  avgExpectedAov: number;
  avgExpectedConversion: number;
};

const STEP_LABELS: Record<FunnelStepType, string> = {
  front_end: "Front-end",
  order_bump: "Order Bump",
  upsell_1: "Upsell 1",
  upsell_2: "Upsell 2",
  downsell: "Downsell",
  thank_you: "Thank You",
};

const DEFAULT_TAKE_RATES: Record<FunnelStepType, number> = {
  front_end: 1,
  order_bump: 0.32,
  upsell_1: 0.18,
  upsell_2: 0.1,
  downsell: 0.22,
  thank_you: 1,
};

const DEFAULT_BASE_CONVERSION = 0.035;

export function getFunnelStepLabel(stepType: FunnelStepType): string {
  return STEP_LABELS[stepType];
}

export function readStepPrice(step: FunnelStep): number | null {
  if (!step.metadata || typeof step.metadata !== "object" || Array.isArray(step.metadata)) {
    return null;
  }
  const meta = step.metadata as Record<string, unknown>;
  const price = meta.price ?? meta.preco;
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price === "string" && price.trim()) {
    const parsed = Number(price.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readStepTakeRate(step: FunnelStep): number | null {
  if (!step.metadata || typeof step.metadata !== "object" || Array.isArray(step.metadata)) {
    return null;
  }
  const meta = step.metadata as Record<string, unknown>;
  const rate = meta.take_rate ?? meta.take_rate_hint;
  if (typeof rate === "number" && Number.isFinite(rate)) {
    return rate > 1 ? rate / 100 : rate;
  }
  return DEFAULT_TAKE_RATES[step.step_type] ?? null;
}

export function buildStepPricing(steps: FunnelStep[]): FunnelStepPricing[] {
  return steps
    .map((step) => {
      const price = readStepPrice(step);
      const takeRate = readStepTakeRate(step);
      if (price == null || takeRate == null) return null;
      return {
        step_type: step.step_type,
        price,
        take_rate: takeRate,
      };
    })
    .filter((item): item is FunnelStepPricing => item != null);
}

export function calculateExpectedAOV(
  steps: FunnelStep[],
  overrides?: Partial<Record<FunnelStepType, number>>
): number {
  const pricing = buildStepPricing(steps);
  let aov = 0;

  for (const item of pricing) {
    if (item.step_type === "thank_you") continue;
    const takeRate = overrides?.[item.step_type] ?? item.take_rate;
    if (item.step_type === "front_end") {
      aov += item.price;
      continue;
    }
    aov += item.price * takeRate;
  }

  return Math.round(aov * 100) / 100;
}

export function calculateExpectedConversion(params: {
  steps: FunnelStep[];
  baseConversion?: number;
  growthConversionRate?: number | null;
  revenueConversionRate?: number | null;
}): number {
  const { steps, baseConversion, growthConversionRate, revenueConversionRate } = params;

  const candidates = [
    baseConversion,
    growthConversionRate,
    revenueConversionRate,
    DEFAULT_BASE_CONVERSION,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  let conversion = candidates[0] ?? DEFAULT_BASE_CONVERSION;
  if (growthConversionRate && growthConversionRate > conversion) {
    conversion = growthConversionRate;
  }
  if (revenueConversionRate && revenueConversionRate > 0 && revenueConversionRate < conversion) {
    conversion = (conversion + revenueConversionRate) / 2;
  }

  const bumpRate = readStepTakeRate(steps.find((s) => s.step_type === "order_bump") ?? steps[0]);
  const upsellRate = readStepTakeRate(steps.find((s) => s.step_type === "upsell_1") ?? steps[0]);

  if (bumpRate && bumpRate > 0.25) conversion *= 1.04;
  if (upsellRate && upsellRate > 0.15) conversion *= 1.03;

  return Math.round(Math.min(Math.max(conversion, 0.005), 0.25) * 10000) / 10000;
}

export function generateFunnelMap(funnel: Funnel, steps: FunnelStep[]): FunnelMap {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const expectedAov =
    funnel.expected_aov != null
      ? Number(funnel.expected_aov)
      : calculateExpectedAOV(ordered);
  const expectedConversion =
    funnel.expected_conversion != null
      ? Number(funnel.expected_conversion)
      : calculateExpectedConversion({ steps: ordered });

  const nodes: FunnelMapNode[] = ordered.map((step) => {
    const price = readStepPrice(step);
    const takeRate = readStepTakeRate(step);
    const expectedRevenue =
      price != null && takeRate != null
        ? step.step_type === "front_end" || step.step_type === "thank_you"
          ? step.step_type === "front_end"
            ? price
            : null
          : Math.round(price * takeRate * 100) / 100
        : null;

    return {
      step_type: step.step_type,
      step_order: step.step_order,
      label: getFunnelStepLabel(step.step_type),
      price,
      take_rate: takeRate,
      expected_revenue: expectedRevenue,
      status: step.status,
      links: {
        product_id: step.product_id,
        landing_id: step.landing_id,
        copy_id: step.copy_id,
        creative_id: step.creative_id,
        offer_id: step.offer_id,
      },
    };
  });

  const flow = nodes.map((node) => node.label);
  const summary = `Funil ${funnel.funnel_name}: ${nodes.length} etapas · AOV esperado R$ ${expectedAov.toFixed(2)} · conversão ${(expectedConversion * 100).toFixed(2)}%`;

  return {
    funnel_id: funnel.id,
    funnel_name: funnel.funnel_name,
    funnel_type: funnel.funnel_type,
    niche: funnel.niche,
    total_steps: nodes.length,
    expected_aov: expectedAov,
    expected_conversion: expectedConversion,
    nodes,
    flow,
    summary,
  };
}

export function computeFunnelEngineDashboard(funnels: Funnel[]): FunnelEngineDashboardMetrics {
  const ready = funnels.filter((f) => f.status === "ready" || f.status === "active").length;
  const active = funnels.filter((f) => f.status === "active").length;
  const aovValues = funnels
    .map((f) => (f.expected_aov != null ? Number(f.expected_aov) : null))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const conversionValues = funnels
    .map((f) => (f.expected_conversion != null ? Number(f.expected_conversion) : null))
    .filter((v): v is number => v != null && Number.isFinite(v));

  return {
    total: funnels.length,
    ready,
    active,
    avgExpectedAov:
      aovValues.length > 0
        ? Math.round((aovValues.reduce((sum, v) => sum + v, 0) / aovValues.length) * 100) / 100
        : 0,
    avgExpectedConversion:
      conversionValues.length > 0
        ? Math.round(
            (conversionValues.reduce((sum, v) => sum + v, 0) / conversionValues.length) * 10000
          ) / 10000
        : 0,
  };
}

export function mergeFunnelMetadata(
  current: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

export function buildFunnelEngineAuraContext(bundle: FunnelBundle): string {
  const map = bundle.map;
  const lines = [
    `Funil: ${map.funnel_name}`,
    `Tipo: ${map.funnel_type}`,
    `Nicho: ${map.niche ?? "—"}`,
    `AOV esperado: R$ ${map.expected_aov.toFixed(2)}`,
    `Conversão esperada: ${(map.expected_conversion * 100).toFixed(2)}%`,
    `Fluxo: ${map.flow.join(" → ")}`,
    ...map.nodes.map(
      (node) =>
        `- ${node.label}: R$ ${node.price?.toFixed(2) ?? "—"} · take ${node.take_rate != null ? `${Math.round(node.take_rate * 100)}%` : "—"}`
    ),
  ];
  return lines.join("\n");
}
