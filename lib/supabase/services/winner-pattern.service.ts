import type { ConversionBestCard } from "@/utils/conversion-intelligence";
import type { UnifiedDecision } from "@/utils/aura-decision-engine";
import type { GrowthBestCard } from "@/utils/growth-brain";
import type { GrowthPattern, KnowledgeEntry, KnowledgePattern } from "@/types/database";
import { nicheMatchesSignal } from "@/utils/offer-engine";
import { readStringArray } from "@/utils/expert-brain";
import {
  buildWinnerPatternPromptBlock,
  dedupeWinnerEntries,
  emptyWinnerContext,
  logWinnerPatternInjected,
  type WinnerContext,
  type WinnerContextFilters,
  type WinnerPatternEntry,
} from "@/utils/winner-pattern";
import { getOptionalDataContext } from "./context";
import { getConversionIntelligenceDashboard } from "./conversion-intelligence.service";
import { getGrowthBrainDashboard } from "./growth-brain.service";
import { getUnifiedDecisionsReadOnly } from "./aura-decision-engine.service";
import { getKnowledgeDashboard } from "./knowledge.service";
import { getExpertPatternsForWinnerContext, getExpertSuccessPatternsForWinnerContext } from "./expert-brain.service";

const MAX_ENTRIES = 5;

function growthCardToEntry(
  card: GrowthBestCard | null,
  source: string
): WinnerPatternEntry | null {
  if (!card?.label?.trim()) return null;
  return {
    label: card.label.trim(),
    score: card.score,
    insight: card.lesson,
    recommendation: card.recommendation,
    source,
  };
}

function conversionCardToEntry(
  card: ConversionBestCard | null,
  source: string
): WinnerPatternEntry | null {
  if (!card?.label?.trim()) return null;
  return {
    label: card.label.trim(),
    score: card.score,
    insight: card.insight,
    recommendation: card.recommendation,
    source,
  };
}

function decisionToEntry(decision: UnifiedDecision | null): WinnerPatternEntry | null {
  if (!decision?.label?.trim()) return null;
  return {
    label: decision.label.trim(),
    score: decision.score,
    insight: decision.reason,
    source: decision.source,
  };
}

function knowledgeEntryToHeadline(entry: KnowledgeEntry): WinnerPatternEntry | null {
  if (!entry.title?.trim()) return null;
  return {
    label: entry.title.trim(),
    score: entry.performance_score,
    insight: entry.description,
    source: "knowledge",
  };
}

function knowledgePatternToEntry(pattern: KnowledgePattern): WinnerPatternEntry | null {
  if (!pattern.label?.trim()) return null;
  return {
    label: pattern.label.trim(),
    score: pattern.confidence_score,
    insight: pattern.description,
    source: "knowledge",
  };
}

function growthPatternToEntries(pattern: GrowthPattern): WinnerPatternEntry[] {
  const source = "growth_brain";
  const label =
    pattern.lesson?.trim() ||
    pattern.recommendation?.trim() ||
    pattern.niche?.trim() ||
    pattern.country?.trim();

  if (!label) return [];

  return [
    {
      label,
      score: pattern.score,
      insight: pattern.lesson,
      recommendation: pattern.recommendation,
      source,
    },
  ];
}

function growthPatternMatchesFilters(
  pattern: GrowthPattern,
  filters?: WinnerContextFilters
): boolean {
  if (filters?.niche && pattern.niche && !nicheMatchesSignal(filters.niche, pattern.niche)) {
    return false;
  }
  if (
    filters?.country &&
    pattern.country &&
    pattern.country.toUpperCase() !== filters.country.toUpperCase()
  ) {
    return false;
  }
  return true;
}

function finalizeCategory(entries: WinnerPatternEntry[]): WinnerPatternEntry[] {
  return dedupeWinnerEntries(entries).slice(0, MAX_ENTRIES);
}

export async function getWinnerContext(filters?: WinnerContextFilters): Promise<{
  context: WinnerContext;
  promptBlock: string;
  error: string | null;
}> {
  const authCtx = await getOptionalDataContext();
  if (!authCtx) {
    const empty = emptyWinnerContext();
    return { context: empty, promptBlock: "", error: "Usuário não autenticado." };
  }

  const [conversion, growth, decisions, knowledge, expertPatterns, expertSuccessPatterns] =
    await Promise.all([
    getConversionIntelligenceDashboard(),
    getGrowthBrainDashboard(),
    getUnifiedDecisionsReadOnly(),
    getKnowledgeDashboard(),
    getExpertPatternsForWinnerContext(),
    getExpertSuccessPatternsForWinnerContext(),
  ]);

  const headlines: WinnerPatternEntry[] = [];
  const offers: WinnerPatternEntry[] = [];
  const creatives: WinnerPatternEntry[] = [];
  const countries: WinnerPatternEntry[] = [];
  const niches: WinnerPatternEntry[] = [];

  const conversionDashboard = conversion.dashboard;
  const headlineCard = conversionCardToEntry(conversionDashboard.melhorHeadline, "conversion_intelligence");
  const offerCard = conversionCardToEntry(conversionDashboard.melhorOferta, "conversion_intelligence");
  const creativeCard = conversionCardToEntry(conversionDashboard.melhorCriativo, "conversion_intelligence");
  const countryCard = conversionCardToEntry(conversionDashboard.melhorPais, "conversion_intelligence");

  if (headlineCard) headlines.push(headlineCard);
  if (offerCard) offers.push(offerCard);
  if (creativeCard) creatives.push(creativeCard);
  if (countryCard) countries.push(countryCard);

  const growthDashboard = growth.dashboard;
  if (growthDashboard) {
    const copyCard = growthCardToEntry(growthDashboard.melhorCopy, "growth_brain");
    const creativeGrowth = growthCardToEntry(growthDashboard.melhorCriativo, "growth_brain");
    const nicheCard = growthCardToEntry(growthDashboard.melhorNicho, "growth_brain");
    const countryGrowth = growthCardToEntry(growthDashboard.melhorPais, "growth_brain");

    if (copyCard) headlines.push(copyCard);
    if (creativeGrowth) creatives.push(creativeGrowth);
    if (nicheCard) niches.push(nicheCard);
    if (countryGrowth) countries.push(countryGrowth);

    for (const pattern of growthDashboard.patterns ?? []) {
      if (!growthPatternMatchesFilters(pattern, filters)) continue;
      const entries = growthPatternToEntries(pattern);
      if (entries.length === 0) continue;

      switch (pattern.pattern_type) {
        case "copy":
          headlines.push(...entries);
          break;
        case "creative":
          creatives.push(...entries);
          break;
        case "revenue":
          offers.push(...entries);
          break;
        case "country":
          if (pattern.country) {
            countries.push({
              label: pattern.country,
              score: pattern.score,
              insight: pattern.lesson,
              recommendation: pattern.recommendation,
              source: "growth_brain",
            });
          }
          break;
        case "niche":
          if (pattern.niche) {
            niches.push({
              label: pattern.niche,
              score: pattern.score,
              insight: pattern.lesson,
              recommendation: pattern.recommendation,
              source: "growth_brain",
            });
          }
          break;
        default:
          break;
      }
    }
  }

  const unified = decisions.decisions;
  if (unified) {
    const bestOffer = decisionToEntry(unified.bestOffer);
    const bestCreative = decisionToEntry(unified.bestCreative);
    const bestCountry = decisionToEntry(unified.bestCountry);
    const bestProduct = decisionToEntry(unified.bestProduct);

    if (bestOffer) offers.push(bestOffer);
    if (bestCreative) creatives.push(bestCreative);
    if (bestCountry) countries.push(bestCountry);
    if (bestProduct) niches.push(bestProduct);
  }

  const activeWinners = knowledge.entries.filter(
    (entry) => entry.category === "winner" && entry.status === "active"
  );

  for (const entry of activeWinners.slice(0, 10)) {
    const headline = knowledgeEntryToHeadline(entry);
    if (headline) headlines.push(headline);

    if (entry.country?.trim()) {
      countries.push({
        label: entry.country.trim(),
        score: entry.performance_score,
        insight: entry.title,
        source: "knowledge",
      });
    }
  }

  for (const pattern of knowledge.patterns) {
    if (pattern.pattern_type === "what_worked" || pattern.pattern_type === "best_campaign") {
      const headline = knowledgePatternToEntry(pattern);
      if (headline) headlines.push(headline);
    }

    if (pattern.pattern_type === "best_country") {
      const countryLabel = pattern.country?.trim() || pattern.label?.trim();
      if (countryLabel) {
        countries.push({
          label: countryLabel,
          score: pattern.confidence_score,
          insight: pattern.description,
          source: "knowledge",
        });
      }
    }

    if (pattern.pattern_type === "best_market") {
      const niche = knowledgePatternToEntry(pattern);
      if (niche) niches.push(niche);
    }
  }

  for (const pattern of expertPatterns) {
    const label = pattern.title?.trim();
    if (!label) continue;

    const entry: WinnerPatternEntry = {
      label,
      score: pattern.confidence_score,
      insight: pattern.description,
      source: "expert_brain",
    };

    const applies = Array.isArray(pattern.applies_to)
      ? pattern.applies_to.filter((item): item is string => typeof item === "string")
      : [];

    if (
      applies.some((cat) =>
        ["copywriting", "sales_psychology", "launch_strategy"].includes(cat)
      )
    ) {
      headlines.push(entry);
    }
    if (applies.some((cat) => ["offer_creation", "funnel_strategy"].includes(cat))) {
      offers.push(entry);
    }
    if (
      applies.some((cat) =>
        ["creative_strategy", "paid_traffic", "landing_page"].includes(cat)
      )
    ) {
      creatives.push(entry);
    }
    if (applies.includes("product_creation")) {
      niches.push(entry);
    }
    if (pattern.pattern_type === "winner_signal") {
      headlines.push(entry);
      offers.push(entry);
    }
  }

  for (const pattern of expertSuccessPatterns) {
    const label = pattern.title?.trim();
    if (!label) continue;

    const entry: WinnerPatternEntry = {
      label,
      score: 78,
      insight: pattern.description,
      recommendation: readStringArray(pattern.scaling_actions).slice(0, 2).join("; ") || null,
      source: "expert_success_pattern",
    };

    headlines.push(entry);
    offers.push(entry);
    creatives.push(entry);
  }

  const context: WinnerContext = {
    headlines: finalizeCategory(headlines),
    offers: finalizeCategory(offers),
    creatives: finalizeCategory(creatives),
    countries: finalizeCategory(countries),
    niches: finalizeCategory(niches),
  };

  const promptBlock = buildWinnerPatternPromptBlock(context);
  logWinnerPatternInjected(filters?.module ?? "global", context);

  return { context, promptBlock, error: null };
}
