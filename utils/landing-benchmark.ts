import type { LandingPage } from "@/types/database";
import {
  parseLandingBenefits,
  parseLandingFaq,
  parseLandingOffer,
  parseLandingProof,
} from "@/utils/landing-factory";

export const LANDING_EXCELLENCE_MIN = 85;
export const LANDING_EXCELLENCE_MAX_CYCLES = 3;

export type LandingBenchmarkStyle = "hormozi" | "finch" | "brunson" | "clickfunnels";

export const LANDING_BENCHMARK_STYLES: {
  id: LandingBenchmarkStyle;
  label: string;
  weights: LandingBenchmarkWeights;
}[] = [
  {
    id: "hormozi",
    label: "Hormozi style",
    weights: { headline: 0.22, oferta: 0.22, cta: 0.18, prova: 0.15, escassez: 0.13, estrutura: 0.1 },
  },
  {
    id: "finch",
    label: "Finch style",
    weights: { headline: 0.2, oferta: 0.18, cta: 0.2, prova: 0.18, escassez: 0.12, estrutura: 0.12 },
  },
  {
    id: "brunson",
    label: "Brunson style",
    weights: { headline: 0.18, oferta: 0.2, cta: 0.16, prova: 0.16, escassez: 0.15, estrutura: 0.15 },
  },
  {
    id: "clickfunnels",
    label: "ClickFunnels top pages",
    weights: { headline: 0.2, oferta: 0.2, cta: 0.2, prova: 0.14, escassez: 0.13, estrutura: 0.13 },
  },
];

export type LandingBenchmarkWeights = {
  headline: number;
  oferta: number;
  cta: number;
  prova: number;
  escassez: number;
  estrutura: number;
};

export type LandingQualityBreakdown = {
  headline: number;
  oferta: number;
  cta: number;
  prova: number;
  escassez: number;
  estrutura: number;
};

export type LandingQualityResult = {
  landing_quality_score: number;
  breakdown: LandingQualityBreakdown;
  benchmark_style: LandingBenchmarkStyle;
  benchmark_score: number;
  deliverable: boolean;
  issues: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreHeadline(page: Pick<LandingPage, "headline" | "subheadline" | "hero_copy">): number {
  const headline = page.headline?.trim() ?? "";
  const sub = page.subheadline?.trim() ?? "";
  const hero = page.hero_copy?.trim() ?? "";
  let score = 0;
  if (headline.length >= 12) score += 30;
  if (headline.length >= 25) score += 15;
  if (sub.length >= 20) score += 20;
  if (hero.length >= 40) score += 20;
  if (/como|sem|em \d+|método|protocolo|blueprint/i.test(`${headline} ${sub}`)) score += 15;
  return clampScore(score);
}

function scoreOferta(offer: ReturnType<typeof parseLandingOffer>): number {
  let score = 0;
  if (offer.price_label) score += 25;
  if (offer.stack?.length || offer.bonuses?.length) score += 25;
  if (offer.guarantee) score += 25;
  if (offer.original_price) score += 15;
  if ((offer.bonuses?.length ?? 0) >= 2 || (offer.stack?.length ?? 0) >= 2) score += 10;
  return clampScore(score);
}

function scoreCta(cta: string | null): number {
  const text = cta?.trim() ?? "";
  if (!text) return 0;
  let score = 50;
  if (text.length >= 8) score += 15;
  if (/quero|garanta|comece|acesse|inscreva|comprar|start|get/i.test(text)) score += 20;
  if (text.length <= 40) score += 15;
  return clampScore(score);
}

function scoreProva(proof: ReturnType<typeof parseLandingProof>): number {
  const testimonials = proof.testimonials ?? [];
  const stats = proof.stats ?? [];
  let score = 0;
  if (testimonials.length >= 1) score += 35;
  if (testimonials.length >= 3) score += 25;
  if (stats.length >= 1) score += 20;
  if (testimonials.some((t) => t.resultado)) score += 20;
  return clampScore(score);
}

function scoreEscassez(offer: ReturnType<typeof parseLandingOffer>): number {
  const urgency = offer.urgency?.trim() ?? "";
  if (!urgency) return 30;
  let score = 50;
  if (/vagas|limitad|últim|expira|hoje|restam|countdown/i.test(urgency)) score += 30;
  if (urgency.length >= 15) score += 20;
  return clampScore(score);
}

function scoreEstrutura(
  page: Pick<LandingPage, "benefits_json" | "faq_json" | "hero_copy" | "headline">,
  benefits: ReturnType<typeof parseLandingBenefits>,
  faq: ReturnType<typeof parseLandingFaq>
): number {
  let score = 0;
  if (benefits.length >= 3) score += 25;
  if (benefits.length >= 5) score += 15;
  if (faq.length >= 3) score += 25;
  if (page.hero_copy?.trim()) score += 15;
  if (page.headline?.trim()) score += 20;
  return clampScore(score);
}

export function computeLandingQualityScore(
  page: Pick<
    LandingPage,
    | "headline"
    | "subheadline"
    | "hero_copy"
    | "benefits_json"
    | "proof_json"
    | "offer_json"
    | "faq_json"
    | "cta_text"
  >,
  preferredStyle: LandingBenchmarkStyle = "hormozi"
): LandingQualityResult {
  const benefits = parseLandingBenefits(page.benefits_json);
  const proof = parseLandingProof(page.proof_json);
  const offer = parseLandingOffer(page.offer_json);
  const faq = parseLandingFaq(page.faq_json);

  const breakdown: LandingQualityBreakdown = {
    headline: scoreHeadline(page),
    oferta: scoreOferta(offer),
    cta: scoreCta(page.cta_text),
    prova: scoreProva(proof),
    escassez: scoreEscassez(offer),
    estrutura: scoreEstrutura(page, benefits, faq),
  };

  const issues: string[] = [];
  if (breakdown.headline < 70) issues.push("Headline fraca — reforçar promessa e especificidade.");
  if (breakdown.oferta < 70) issues.push("Oferta incompleta — adicionar stack, bônus e garantia.");
  if (breakdown.cta < 70) issues.push("CTA pouco persuasivo.");
  if (breakdown.prova < 60) issues.push("Prova social insuficiente.");
  if (breakdown.escassez < 50) issues.push("Escassez/urgência ausente.");
  if (breakdown.estrutura < 65) issues.push("Estrutura da página incompleta.");

  const styleConfig =
    LANDING_BENCHMARK_STYLES.find((s) => s.id === preferredStyle) ?? LANDING_BENCHMARK_STYLES[0]!;
  const w = styleConfig.weights;

  const landing_quality_score = clampScore(
    breakdown.headline * w.headline +
      breakdown.oferta * w.oferta +
      breakdown.cta * w.cta +
      breakdown.prova * w.prova +
      breakdown.escassez * w.escassez +
      breakdown.estrutura * w.estrutura
  );

  const benchmarkScores = LANDING_BENCHMARK_STYLES.map((style) => {
    const weights = style.weights;
    return (
      breakdown.headline * weights.headline +
      breakdown.oferta * weights.oferta +
      breakdown.cta * weights.cta +
      breakdown.prova * weights.prova +
      breakdown.escassez * weights.escassez +
      breakdown.estrutura * weights.estrutura
    );
  });
  const benchmark_score = clampScore(Math.max(...benchmarkScores));

  return {
    landing_quality_score,
    breakdown,
    benchmark_style: preferredStyle,
    benchmark_score,
    deliverable: landing_quality_score >= LANDING_EXCELLENCE_MIN,
    issues,
  };
}

export function isLandingDeliverable(score: number): boolean {
  return score >= LANDING_EXCELLENCE_MIN;
}
