import { notFound } from "next/navigation";
import { RecommendationViewClient } from "@/components/dashboard/recommendations/recommendation-view-client";
import {
  explainRecommendationItem,
  getRecommendationItem,
} from "@/lib/supabase/services/recommendation.service";

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let item = null;
  let explanation = null;
  try {
    item = await getRecommendationItem(id);
    if (item) explanation = await explainRecommendationItem(id);
  } catch {
    item = null;
  }
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <RecommendationViewClient item={item} explanation={explanation} />
    </div>
  );
}
