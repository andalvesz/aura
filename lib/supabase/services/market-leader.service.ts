import { MarketBenchmarksRepository } from "@/lib/supabase/repositories/market-leader.repository";
import type { ExcellenceAssetType, MarketBenchmark } from "@/types/database";
import {
  compareToBenchmark,
  mapAssetTypeToBenchmarkCategory,
  type BenchmarkComparisonResult,
} from "@/utils/market-leader";
import { getOptionalDataContext } from "./context";

export async function loadBenchmarkForAsset(
  assetType: ExcellenceAssetType
): Promise<{ benchmark: MarketBenchmark | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  const category = mapAssetTypeToBenchmarkCategory(assetType);

  if (!ctx) {
    return { benchmark: null, error: null };
  }

  const repo = new MarketBenchmarksRepository(ctx.supabase);
  const { data, error } = await repo.findByCategory(category);
  return { benchmark: data, error };
}

export async function compareAssetToBenchmark(params: {
  content: string;
  assetType: ExcellenceAssetType;
}): Promise<BenchmarkComparisonResult> {
  const category = mapAssetTypeToBenchmarkCategory(params.assetType);
  const { benchmark } = await loadBenchmarkForAsset(params.assetType);

  return compareToBenchmark({
    content: params.content,
    category,
    benchmark,
  });
}

export { compareToBenchmark } from "@/utils/market-leader";
