import { CreatorAdsCampaignsRepository } from "@/lib/supabase/repositories/creator-ads.repository";
import { CreatorResearchRepository } from "@/lib/supabase/repositories/research.repository";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import type { CreatorAdsCampaign, CreatorResearch } from "@/types/database";
import {
  DEFAULT_CREATOR_LOCALE,
  localeFieldsFromSource,
  type CreatorLocale,
} from "@/utils/creator-locale";
import { getOptionalDataContext } from "./context";

export type LocaleSource = "product" | "research" | "ads" | null;

export async function getResolvedUserLocale(): Promise<{
  locale: CreatorLocale;
  source: LocaleSource;
  sourceId: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      locale: DEFAULT_CREATOR_LOCALE,
      source: null,
      sourceId: null,
      error: "Usuário não autenticado.",
    };
  }

  const [{ bundles }, researchRepo, adsRepo] = [
    await loadCreatorBundles(),
    new CreatorResearchRepository(ctx.supabase, ctx.userId),
    new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId),
  ] as const;

  const latestProduct = bundles[0]?.product;
  if (latestProduct?.target_country) {
    return {
      locale: localeFieldsFromSource(latestProduct),
      source: "product",
      sourceId: latestProduct.id,
      error: null,
    };
  }

  const { data: research } = await researchRepo.findAllOrdered();
  const latestResearch = (research ?? [])[0] as CreatorResearch | undefined;
  if (latestResearch?.target_country) {
    return {
      locale: localeFieldsFromSource(latestResearch),
      source: "research",
      sourceId: latestResearch.id,
      error: null,
    };
  }

  const { data: ads } = await adsRepo.findAllOrdered();
  const latestAds = (ads ?? [])[0] as CreatorAdsCampaign | undefined;
  if (latestAds?.target_country) {
    return {
      locale: localeFieldsFromSource(latestAds),
      source: "ads",
      sourceId: latestAds.id,
      error: null,
    };
  }

  return {
    locale: DEFAULT_CREATOR_LOCALE,
    source: null,
    sourceId: null,
    error: null,
  };
}
