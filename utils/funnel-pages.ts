import type { Funnel, FunnelPage, FunnelPageType, FunnelStepType, LandingPage, Offer } from "@/types/database";

export const FUNNEL_PAGES_SAFE_MODE = {
  active: false,
  message: "Use Publicar funil para publicar todas as páginas de uma vez.",
};

export type FunnelPublishPageKey =
  | "front_end"
  | "order_bump"
  | "upsell_1"
  | "upsell_2"
  | "downsell"
  | "thank_you";

export type FunnelPublishPageStatus =
  | "published"
  | "already_published"
  | "failed"
  | "skipped";

export type FunnelPublishPageResult = {
  key: FunnelPublishPageKey;
  label: string;
  funnel_page_id: string | null;
  landing_page_id: string | null;
  status: FunnelPublishPageStatus;
  url: string | null;
  published_at: string | null;
  error: string | null;
};

export type FunnelPublishResult = {
  funnel_id: string;
  status: "published" | "partial" | "failed";
  published_at: string | null;
  pages: FunnelPublishPageResult[];
  log_id: string | null;
};

export const FUNNEL_PUBLISH_ORDER: FunnelPublishPageKey[] = [
  "front_end",
  "order_bump",
  "upsell_1",
  "upsell_2",
  "downsell",
  "thank_you",
];

const FUNNEL_PUBLISH_LABELS: Record<FunnelPublishPageKey, string> = {
  front_end: "Front End",
  order_bump: "Bump",
  upsell_1: "Upsell 1",
  upsell_2: "Upsell 2",
  downsell: "Downsell",
  thank_you: "Thank You",
};

const STEP_TYPE_BY_PUBLISH_KEY: Record<FunnelPublishPageKey, FunnelStepType> = {
  front_end: "front_end",
  order_bump: "order_bump",
  upsell_1: "upsell_1",
  upsell_2: "upsell_2",
  downsell: "downsell",
  thank_you: "thank_you",
};

export type FunnelPagesIntake = {
  funnel_id: string;
  product_id?: string | null;
  operation_id?: string | null;
  copylab_id?: string | null;
  include_quiz?: boolean;
  include_webinar?: boolean;
};

export type FunnelPageBestCard = {
  pageId: string;
  label: string;
  pageType: FunnelPageType;
  conversionGoal: number;
  slug: string;
  score: number;
};

export type FunnelPagesDashboard = {
  totalPages: number;
  publishedPages: number;
  expectedConversion: number;
  bestPage: FunnelPageBestCard | null;
};

export type FunnelPagesBundle = {
  funnel: Funnel;
  pages: FunnelPage[];
  landings: LandingPage[];
};

const DEFAULT_CONVERSION_GOALS: Record<FunnelPageType, number> = {
  front_end: 0.035,
  order_bump: 0.32,
  upsell: 0.18,
  downsell: 0.22,
  thank_you: 1,
  webinar: 0.12,
  quiz: 0.28,
};

export function readFunnelPageConversionGoal(page: FunnelPage): number {
  if (page.conversion_goal != null && Number.isFinite(Number(page.conversion_goal))) {
    const rate = Number(page.conversion_goal);
    return rate > 1 ? rate / 100 : rate;
  }
  return DEFAULT_CONVERSION_GOALS[page.page_type] ?? 0.1;
}

export function computeFunnelPagesDashboard(params: {
  pages: FunnelPage[];
  funnelConversion?: number | null;
}): FunnelPagesDashboard {
  const { pages, funnelConversion } = params;
  const publishedPages = pages.filter((page) => page.status === "published").length;

  const conversionRates = pages.map((page) => readFunnelPageConversionGoal(page));
  const expectedConversion =
    funnelConversion != null && Number.isFinite(Number(funnelConversion))
      ? Number(funnelConversion)
      : conversionRates.length > 0
        ? Math.round(
            (conversionRates.reduce((acc, rate) => acc + rate, 0) / conversionRates.length) * 10000
          ) / 10000
        : 0;

  let bestPage: FunnelPageBestCard | null = null;
  for (const page of pages) {
    const conversionGoal = readFunnelPageConversionGoal(page);
    const score = Math.round(conversionGoal * 10000);
    if (!bestPage || score > bestPage.score) {
      bestPage = {
        pageId: page.id,
        label: page.title,
        pageType: page.page_type,
        conversionGoal,
        slug: page.slug,
        score,
      };
    }
  }

  return {
    totalPages: pages.length,
    publishedPages,
    expectedConversion,
    bestPage,
  };
}

export function formatConversionRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export function pageTypeLabel(pageType: FunnelPageType): string {
  const labels: Record<FunnelPageType, string> = {
    front_end: "Front-end",
    order_bump: "Order bump",
    upsell: "Upsell",
    downsell: "Downsell",
    thank_you: "Thank you",
    webinar: "Webinar",
    quiz: "Quiz",
  };
  return labels[pageType] ?? pageType;
}

export function resolveOfferForPageType(
  offers: Offer[],
  pageType: FunnelPageType,
  index = 0
): Offer | null {
  if (pageType === "front_end") {
    return offers.find((offer) => offer.offer_type === "front_end") ?? null;
  }
  if (pageType === "order_bump") {
    return offers.find((offer) => offer.offer_type === "order_bump") ?? null;
  }
  if (pageType === "upsell") {
    const upsells = offers.filter((offer) => offer.offer_type === "upsell");
    return upsells[index] ?? upsells[0] ?? null;
  }
  if (pageType === "downsell") {
    return offers.find((offer) => offer.offer_type === "downsell") ?? null;
  }
  return null;
}

export function buildFunnelPagesAuraContext(bundle: FunnelPagesBundle): string {
  const lines = [
    `Funil: ${bundle.funnel.funnel_name}`,
    `Páginas: ${bundle.pages.length}`,
    `Conversão esperada: ${formatConversionRate(Number(bundle.funnel.expected_conversion ?? 0))}`,
    ...bundle.pages.slice(0, 6).map(
      (page) =>
        `- ${pageTypeLabel(page.page_type)}: ${page.title} (${page.status}) · meta ${formatConversionRate(readFunnelPageConversionGoal(page))}`
    ),
  ];
  return lines.join("\n");
}

export function mergeFunnelPageMetadata(
  current: FunnelPage["metadata"],
  patch: Record<string, unknown>
): FunnelPage["metadata"] {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as FunnelPage["metadata"];
}

function readUpsellIndex(page: FunnelPage): number {
  const metadata = page.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const index = (metadata as Record<string, unknown>).upsell_index;
  return typeof index === "number" && Number.isFinite(index) ? index : 0;
}

export function funnelPublishPageLabel(key: FunnelPublishPageKey): string {
  return FUNNEL_PUBLISH_LABELS[key];
}

export function funnelPublishStepType(key: FunnelPublishPageKey): FunnelStepType {
  return STEP_TYPE_BY_PUBLISH_KEY[key];
}

export function resolvePageForPublishKey(
  pages: FunnelPage[],
  key: FunnelPublishPageKey
): FunnelPage | null {
  if (key === "upsell_1") {
    return (
      pages.find((page) => page.page_type === "upsell" && readUpsellIndex(page) === 0) ?? null
    );
  }
  if (key === "upsell_2") {
    return (
      pages.find((page) => page.page_type === "upsell" && readUpsellIndex(page) === 1) ?? null
    );
  }

  const pageTypeByKey: Record<
    Exclude<FunnelPublishPageKey, "upsell_1" | "upsell_2">,
    FunnelPageType
  > = {
    front_end: "front_end",
    order_bump: "order_bump",
    downsell: "downsell",
    thank_you: "thank_you",
  };

  return pages.find((page) => page.page_type === pageTypeByKey[key]) ?? null;
}

export function computeFunnelPublishStatus(
  pages: FunnelPublishPageResult[]
): "published" | "partial" | "failed" {
  const successes = pages.filter(
    (page) => page.status === "published" || page.status === "already_published"
  ).length;
  const failures = pages.filter(
    (page) => page.status === "failed" || page.status === "skipped"
  ).length;

  if (successes === 0) return "failed";
  if (failures === 0) return "published";
  return "partial";
}
