import { PlanCenterClient } from "@/components/dashboard/plans/plan-center-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { listPlanItems } from "@/lib/supabase/services/planner.service";

export default async function PlansPage() {
  let items: Awaited<ReturnType<typeof listPlanItems>> = [];
  try {
    items = await listPlanItems({ limit: 80 });
  } catch {
    /* unauthenticated */
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4" data-testid="plans-page">
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Plan Center" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Plan Center</h1>
        <p className="text-[12px] text-zinc-500">
          Transformar recomendações em planos · sem execução · sem automações ·
          executionInfluence: none
        </p>
      </div>
      <PlanCenterClient initial={items} />
    </div>
  );
}
