import { RecommendationCenterClient } from "@/components/dashboard/recommendations/recommendation-center-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { listRecommendationItems } from "@/lib/supabase/services/recommendation.service";

export default async function RecommendationsPage() {
  let items: Awaited<ReturnType<typeof listRecommendationItems>> = [];
  try {
    items = await listRecommendationItems({ limit: 60, ranked: true });
  } catch {
    /* unauthenticated */
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="recommendations-page"
    >
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Recommendation Center" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">
          Recommendation Center
        </h1>
        <p className="text-[12px] text-zinc-500">
          O que faz mais sentido agora · sem execução · sem planner ·
          executionInfluence: none
        </p>
      </div>
      <RecommendationCenterClient initial={items} />
    </div>
  );
}
